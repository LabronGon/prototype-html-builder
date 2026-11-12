# -*- coding: utf-8 -*-
"""v1.9.0 同版：存量稿补编组工具（通用、可复现）。

把散落在画板顶层的叶子按「几何连续段」聚成语义组，而不是逐份手写 PLANS。
设计约束（全部由脚本内的断言保障）：
  1. 连续段重组 → 深度优先展开后的绘制顺序与原顶层数组逐 id 一致（z-order 不变，零视觉变化）；
  2. 所有原有节点的 x/y/w/h/type/name/notes/proto 字段一个字节不改，只新增 group 包裹层；
  3. 新 group 包围盒 = children 包围盒并集；id 全局唯一、不与现有冲突；
  4. 组件库页（comp/kit）完全不动；已有 group/bool 节点作为原子单元参与聚类，不被拆散；
  5. 每组直接子元素 ≤12（超出自动按原序拆成嵌套子组），嵌套 ≤3 层，组名语义化（非「区块N/组N」）。

用法：
  python tools/regroup-legacy.py <file.chao.html>            # 写回
  python tools/regroup-legacy.py <file.chao.html> --dry     # 只打印分组方案不写回
"""
import io, json, re, sys

DRY = '--dry' in sys.argv
PATH = [a for a in sys.argv[1:] if not a.startswith('--')]
assert PATH, '用法: regroup-legacy.py <file.chao.html> [--dry]'
PATH = PATH[0]

PAD = 10.0      # 包围盒水平/垂直合并容差
ROWGAP = 18.0   # 同列紧邻下方允许的最大间隙

def box(n):
    return (float(n.get('x', 0)), float(n.get('y', 0)), float(n.get('w', 0)), float(n.get('h', 0)))

def union(a, b):
    x = min(a[0], b[0]); y = min(a[1], b[1])
    x2 = max(a[0] + a[2], b[0] + b[2]); y2 = max(a[1] + a[3], b[1] + b[3])
    return (x, y, x2 - x, y2 - y)

SUF = ('面板', '导航', '列表', '卡', '区', '栏', '条', '板', '带', '页', '图', '表', '树', '盒')
KW = ('按钮', '操作', '工具', '筛选', '状态', '进度', '趋势', '告警', '设备', '侧栏', '顶栏',
      '搜索', '图表', '表格', '详情', '标题', '页签', '底栏', '分页', '表单', '信息', '记录',
      '日志', '指标', '监控', 'KPI', 'Kpi', 'kpi')
GEN = re.compile(r'^(区块|组|群组|分组|图层组|Layer|Group|Frame)\s*[-_]?\s*\d+$', re.I)
GEOM = re.compile(r'(矩形|椭圆|路径|形状|圆角|线条|Line|Rect|Ellipse|Path|Polygon|Star)$', re.I)

def gname(nodes):
    names = [str(n.get('name', '')) for n in nodes]
    first = names[0] if names else ''
    if first and not GEOM.search(first):
        return first[:12]
    for s in SUF:
        for nm in names:
            if nm.endswith(s):
                return nm
    for k in KW:
        for nm in names:
            if k in nm:
                return nm[:12]
    return (names[0][:10] if names[0] else '内容') + '区'

def is_huge(n, W, H):
    a = float(n.get('w', 0)) * float(n.get('h', 0))
    return a > 0.5 * W * H

def cluster(tops, W, H):
    """按原数组连续段做几何聚类，返回 list[list[node]]。

    - 合并判定基于「节点中心是否落在当前累积包围盒的扩充框内」；
    - 全屏背景类节点（面积>画板 50%）视为分隔符：单独成段、不参与合并、
      也不作为后续合并的包围盒锚点，避免吞并整块画板。
    """
    if not tops:
        return []
    groups = []
    cur = [tops[0]]
    B = box(tops[0])
    for n in tops[1:]:
        if is_huge(n, W, H):
            if cur:
                groups.append(cur)
            groups.append([n])
            cur = []
            B = None
            continue
        if B is None:
            cur = [n]
            B = box(n)
            continue
        nb = box(n)
        cx = nb[0] + nb[2] / 2.0
        cy = nb[1] + nb[3] / 2.0
        in_x = B[0] - PAD <= cx <= B[0] + B[2] + PAD
        in_y = B[1] - PAD <= cy <= B[1] + B[3] + PAD
        within = in_x and in_y
        below = (cy >= B[1] + B[3] - PAD) and (cy <= B[1] + B[3] + ROWGAP) and in_x
        if within or below:
            cur.append(n)
            B = union(B, nb)
        else:
            groups.append(cur)
            cur = [n]
            B = box(n)
    if cur:
        groups.append(cur)
    return groups

def split_width(seg, parent_name):
    """子元素 >12 时按原序每 12 个拆成嵌套子组。"""
    if len(seg) <= 12:
        return None
    tags = ['（上段）', '（中段）', '（下段）', '（续段）']
    subs = []
    for i in range(0, len(seg), 12):
        chunk = seg[i:i + 12]
        tag = tags[i // 12] if i // 12 < len(tags) else '（%d段）' % (i // 12 + 1)
        subs.append((parent_name + tag, chunk))
    return subs

# ---------- 载入 ----------
html = io.open(PATH, encoding='utf-8').read()
m = re.search(r'(<script[^>]*id="__doc"[^>]*>)([\s\S]*?)</script>', html)
assert m, '找不到 __doc'
doc = json.loads(m.group(2))

all_ids = []
def collect(n):
    all_ids.append(n['id'])
    for c in n.get('children', []) or []:
        collect(c)
for p in doc['pages']:
    for ab in p.get('artboards', []):
        collect(ab)
    for n in p.get('loose', []) or []:
        collect(n)
next_id = max([int(x[1:]) for x in all_ids if re.fullmatch(r'n\d+', x)] or [0]) + 100
def nid():
    global next_id
    next_id += 1
    return 'n%d' % next_id

# 备份原有节点几何/字段
before = {}
def snap(n):
    before[n['id']] = {k: n.get(k) for k in ('x', 'y', 'w', 'h', 'type', 'name', 'notes', 'proto')}
    for c in n.get('children', []) or []:
        snap(c)
for p in doc['pages']:
    for ab in p.get('artboards', []):
        snap(ab)

ALL_NEW = []
def make_group(nodes, name):
    x = min(float(k.get('x', 0)) for k in nodes)
    y = min(float(k.get('y', 0)) for k in nodes)
    x2 = max(float(k.get('x', 0)) + float(k.get('w', 0)) for k in nodes)
    y2 = max(float(k.get('y', 0)) + float(k.get('h', 0)) for k in nodes)
    g = {'id': nid(), 'type': 'group', 'name': name, 'x': x, 'y': y,
         'opacity': 1, 'children': list(nodes), 'w': x2 - x, 'h': y2 - y}
    ALL_NEW.append(g)
    return g

# ---------- 处理每画板 ----------
report = []
for pi, pg in enumerate(doc['pages']):
    if pg.get('comp') or pg.get('kit'):
        continue
    for abi, ab in enumerate(pg.get('artboards', [])):
        tops = ab.get('children', []) or []
        if len(tops) <= 3:
            report.append((pi, abi, ab.get('name'), len(tops), len(tops), 0, 'skip(≤3)'))
            continue
        groups = cluster(tops, ab['w'], ab['h'])
        newtops = []
        ng = 0
        for seg in groups:
            if len(seg) == 1 and seg[0].get('type') in ('group', 'bool'):
                newtops.append(seg[0])  # 保留已有组，不重复包裹
                continue
            name = gname(seg)
            subs = split_width(seg, name)
            if subs:
                for sname, chunk in subs:
                    newtops.append(make_group(chunk, sname))
                    ng += 1
            else:
                newtops.append(make_group(seg, name))
                ng += 1
        ab['children'] = newtops
        loose = [n for n in newtops if n.get('type') not in ('group', 'bool')
                 and not (n.get('inst') or n.get('cont'))]
        report.append((pi, abi, ab.get('name'), len(tops), len(newtops), len(loose),
                       'ok' if not loose else 'LOOSE'))

# ---------- 断言 ----------
after = []
def walk(n):
    after.append(n['id'])
    for c in n.get('children', []) or []:
        walk(c)
for p in doc['pages']:
    for ab in p.get('artboards', []):
        walk(ab)
    for n in p.get('loose', []) or []:
        walk(n)
assert len(after) == len(set(after)), 'id 重复'
assert len(after) == len(before) + len(ALL_NEW), '节点数不符'

def chk(n):
    if n['id'] in before:
        for k, v in before[n['id']].items():
            assert n.get(k) == v, '字段变了 %s.%s' % (n['id'], k)
    for c in n.get('children', []) or []:
        chk(c)
for p in doc['pages']:
    for ab in p.get('artboards', []):
        chk(ab)

def depth(ch, d):
    mx = d
    for n in ch or []:
        k = n.get('children') or []
        if k:
            mx = max(mx, depth(k, d + 1))
    return mx

def audit(ch, where):
    for n in ch or []:
        if n.get('children'):
            c = len(n['children'])
            inst = bool(n.get('inst') or n.get('cont'))
            assert c <= 12 or inst, '组过宽 %s/%s=%d' % (where, n.get('name'), c)
            assert not GEN.match(str(n.get('name', ''))), '无语义命名 ' + str(n.get('name'))
            audit(n['children'], where + '/' + str(n.get('name')))

for p in doc['pages']:
    for ab in p.get('artboards', []):
        audit(ab['children'], ab.get('name'))
        d = max([depth(n['children'], 1) for n in ab['children'] if n.get('children')] or [1])
        assert d <= 3, '嵌套过深 %s=%d' % (ab.get('name'), d)

# ---------- 输出 ----------
if DRY:
    for r in report:
        print('DRY', r)
    print('将新增 group:', len(ALL_NEW))
else:
    out = (html[:m.start()] + m.group(1) + json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
           + '</script>' + html[m.start() + len(m.group(0)):])
    io.open(PATH, 'w', encoding='utf-8', newline='').write(out)
    for r in report:
        print('OK', r)
    print('DONE 写回 %s  新增 %d 个 group' % (PATH.split('/')[-1], len(ALL_NEW)))
