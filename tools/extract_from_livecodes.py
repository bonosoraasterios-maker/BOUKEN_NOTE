from pathlib import Path
from bs4 import BeautifulSoup
import re, base64, hashlib, json, shutil, textwrap, os

ROOT = Path('/mnt/data/BOUKEN_NOTE_ENGINE_V1')
if ROOT.exists():
    shutil.rmtree(ROOT)
for d in [
    'css','js','data','images/backgrounds','images/characters','images/enemies','images/effects','images/ui',
    'sounds/bgm','sounds/se','legacy','docs','tools'
]:
    (ROOT/d).mkdir(parents=True, exist_ok=True)

frozen_path = Path('/mnt/data/BOUKEN_NOTE_v23_46_LIVECODES_IMPORT(1).txt')
phase1_path = Path('/mnt/data/BOUKEN_NOTE_v23_46_PARTS_PHASE1_LIVECODES_IMPORT.txt')
frozen = frozen_path.read_text(encoding='utf-8', errors='ignore')
source = phase1_path.read_text(encoding='utf-8', errors='ignore')

# Freeze source snapshots verbatim.
(ROOT/'legacy/BOUKEN_NOTE_v23_46_FROZEN.html').write_text(frozen, encoding='utf-8')
(ROOT/'legacy/BOUKEN_NOTE_v23_46_PARTS_PHASE1_SOURCE.html').write_text(source, encoding='utf-8')

# Known asset names by SHA1 from the current source.
asset_names = {
    '83e11eca37': 'images/backgrounds/scene_legacy.webp',
    '8432ce4d9d': 'images/ui/attack_button.webp',
    'ba129ecb6f': 'images/effects/starlight_union.webp',
    '092d4015': 'images/characters/aria.webp',
    '726d2d3e': 'images/characters/ceres.webp',
    'd9b748b9': 'images/characters/linnet.webp',
    'a5e99ed8b5': 'images/enemies/daily_enemy.webp',
    '8b604fbd1c': 'sounds/se/slash_1.mp4',
    '4ae82217da': 'sounds/se/slash_2.mp4',
    '3d44c33932': 'sounds/se/slash_3.mp4',
    '9b3b608be0': 'sounds/se/enemy_attack.wav',
    'b0983ed266': 'sounds/se/charge.wav',
    '6476031141': 'sounds/se/union_hit.mp4',
    'aec3950df7': 'sounds/bgm/battle_bgm.mp4',
    '74bdc7b551': 'sounds/se/slash_heavy.mp4',
    'b2b4fd604d': 'sounds/se/enemy_hit.mp4',
    'c7a4dea865': 'sounds/se/heal.mp4',
    '6acb36c531': 'sounds/se/revive.mp4',
    'bb57206ddf': 'sounds/se/holy.mp4',
    '5956e21f2d': 'sounds/se/barrier.mp4',
    '36c768d809': 'images/ui/lower_reference.webp',
    '4d7b8b6265': 'images/enemies/daily_enemy_overlay.png',
    'ba3fe4998e': 'images/enemies/weekly_enemy.webp',
    'bfd15c1616': 'images/backgrounds/battlefield_clean.webp',
    '9790b10444': 'images/characters/protagonist.webp',
    '3dab1ae41e': 'images/ui/title_logo.webp',
}

pat = re.compile(r'data:(image/(?:webp|png|jpeg)|audio/(?:mp4|wav));base64,([A-Za-z0-9+/=]+)')
manifest = []
url_to_path = {}
seen_sha = {}
for m in pat.finditer(source):
    mime, b64 = m.group(1), m.group(2)
    data = base64.b64decode(b64)
    sha = hashlib.sha1(data).hexdigest()
    prefix = sha[:10]
    if sha in seen_sha:
        rel = seen_sha[sha]
    else:
        rel = next((v for k,v in asset_names.items() if sha.startswith(k)), None)
        if not rel:
            ext = {'image/webp':'webp','image/png':'png','image/jpeg':'jpg','audio/mp4':'mp4','audio/wav':'wav'}[mime]
            kind = 'images/ui' if mime.startswith('image/') else 'sounds/se'
            rel = f'{kind}/asset_{len(seen_sha)+1:02d}_{prefix}.{ext}'
        out = ROOT/rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        seen_sha[sha] = rel
        manifest.append({'path': rel, 'mime': mime, 'bytes': len(data), 'sha1': sha})
    url_to_path[m.group(0)] = rel

# Parse HTML and externalize style/script blocks while preserving source order.
soup = BeautifulSoup(source, 'html.parser')

# CSS: concatenate in original style order. CSS relative paths need ../ from css/.
css_parts = []
for i, st in enumerate(list(soup.find_all('style'))):
    txt = st.string if st.string is not None else st.get_text()
    for dataurl, rel in url_to_path.items():
        txt = txt.replace(dataurl, '../' + rel)
    label = st.get('id') or f'anonymous_{i:02d}'
    css_parts.append(f'/* ===== SOURCE STYLE {i:02d}: {label} ===== */\n{txt.strip()}\n')
    st.decompose()
(ROOT/'css/game.css').write_text('\n\n'.join(css_parts) + '\n', encoding='utf-8')

# JS: keep each script as a separate file in exact execution order.
script_files = []
for i, sc in enumerate(list(soup.find_all('script'))):
    txt = sc.string if sc.string is not None else sc.get_text()
    for dataurl, rel in url_to_path.items():
        txt = txt.replace(dataurl, rel)
    sid = sc.get('id')
    if i == 0:
        name = 'game.js'
    elif sid == 'v23_23_weekly_arm_patch':
        name = 'patch-weekly-arm.js'
    elif sid == 'v23_25_visual_runtime':
        name = 'patch-visual-runtime.js'
    elif sid == 'v23_34_background_runtime':
        name = 'patch-background-runtime.js'
    else:
        name = f'patch-{i:02d}.js'
    (ROOT/'js'/name).write_text(txt.strip()+'\n', encoding='utf-8')
    script_files.append(name)
    sc.decompose()

# Replace any data URLs in remaining HTML attributes/content (e.g. img src).
html = str(soup)
for dataurl, rel in url_to_path.items():
    html = html.replace(dataurl, rel)

# Add external CSS + data scaffolds before engine, then exact-order runtime scripts.
soup2 = BeautifulSoup(html, 'html.parser')
head = soup2.head
link = soup2.new_tag('link', rel='stylesheet', href='css/game.css')
head.append(link)
# Build metadata and future data layer. They do not override current legacy runtime yet.
for src in ['data/characters.js','data/enemies.js','data/skills.js','data/missions.js','data/areas.js']:
    tag = soup2.new_tag('script', src=src)
    tag['defer'] = ''
    head.append(tag)
for name in script_files:
    tag = soup2.new_tag('script', src='js/'+name)
    tag['defer'] = ''
    head.append(tag)
main_tag = soup2.new_tag('script', src='js/main.js')
main_tag['defer'] = ''
head.append(main_tag)
# Update title only; no gameplay change.
if soup2.title:
    soup2.title.string = 'ぼうけんノート Engine v1'
index_html = '<!doctype html>\n' + str(soup2)
(ROOT/'index.html').write_text(index_html, encoding='utf-8')

# Data scaffolds: source/spec-aligned, deliberately not authoritative until Phase 2 wiring.
(ROOT/'data/characters.js').write_text("""// Engine v1 migration target. v1.2 terminology: class / job / potentialAbility / skill.
window.BOUKEN_NOTE_DATA = window.BOUKEN_NOTE_DATA || {};
window.BOUKEN_NOTE_DATA.characters = [
  {
    characterId: 'aria', name: 'アリア', classId: 'support', classLabel: 'サポーター',
    jobId: 'cleric', jobLabel: 'クレリック', maxHp: 600,
    art: 'images/characters/aria.webp',
    potentialAbility: 'healing_light', skill: 'heal'
  },
  {
    characterId: 'ceres', name: 'セレス', classId: 'defender', classLabel: 'ディフェンダー',
    jobId: 'guardian', jobLabel: 'ガーディアン', maxHp: 1200,
    art: 'images/characters/ceres.webp',
    potentialAbility: 'holy_guard', skill: 'holy_field'
  },
  {
    characterId: 'linnet', name: 'リネット', classId: 'attacker', classLabel: 'アタッカー',
    jobId: 'tamer', jobLabel: 'テイマー', maxHp: 400,
    art: 'images/characters/linnet.webp',
    potentialAbility: 'tame', skill: 'tame_guard'
  }
];
""", encoding='utf-8')

(ROOT/'data/skills.js').write_text("""window.BOUKEN_NOTE_DATA = window.BOUKEN_NOTE_DATA || {};
window.BOUKEN_NOTE_DATA.skills = {
  healing_light: { id:'healing_light', name:'癒しの光', kind:'potential', spCost:0 },
  heal:          { id:'heal', name:'ヒール', kind:'skill', spCost:1 },
  holy_guard:    { id:'holy_guard', name:'ホーリーガード', kind:'potential', spCost:0 },
  holy_field:    { id:'holy_field', name:'ホーリーフィールド', kind:'skill', spCost:1 },
  tame:          { id:'tame', name:'テイム', kind:'potential', spCost:0 },
  tame_guard:    { id:'tame_guard', name:'テイムガード', kind:'skill', spCost:1 }
};
""", encoding='utf-8')

(ROOT/'data/enemies.js').write_text("""window.BOUKEN_NOTE_DATA = window.BOUKEN_NOTE_DATA || {};
window.BOUKEN_NOTE_DATA.enemies = {
  daily_default: {
    id:'daily_default', type:'daily', name:'アストラル・セントリー', maxHp:800,
    art:'images/enemies/daily_enemy.webp'
  },
  weekly_current: {
    id:'weekly_current', type:'weekly', name:'虚空統べるセレスティア', maxHp:4000,
    art:'images/enemies/weekly_enemy.webp'
  }
};
""", encoding='utf-8')

(ROOT/'data/missions.js').write_text("""window.BOUKEN_NOTE_DATA = window.BOUKEN_NOTE_DATA || {};
window.BOUKEN_NOTE_DATA.missions = {
  daily: [
    { id:'daily_1', label:'5つのお約束', points:5 },
    { id:'daily_2', label:'時間を守る', points:5 },
    { id:'daily_3', label:'フリー（自分で決めたこと）', points:5 }
  ],
  weekly: [
    { id:'weekly_1', label:'本を1冊読む', points:30 },
    { id:'weekly_2', label:'デイリーを5日達成', points:30 },
    { id:'weekly_3', label:'今週の自分プラン', points:30 }
  ],
  special: [
    { id:'special_1', label:'夏休みの宿題を終わらせる', points:100 },
    { id:'special_2', label:'最高を1日分ためる', points:100 },
    { id:'special_3', label:'家族でおでかけした日に！', points:100 }
  ],
  shop: [
    { id:'shop_1', name:'新しい洋服', cost:1000 },
    { id:'shop_2', name:'ゲームソフト', cost:2000 },
    { id:'shop_3', name:'好きな本', cost:800 },
    { id:'shop_4', name:'家族チケット', cost:1500 }
  ]
};
""", encoding='utf-8')

(ROOT/'data/areas.js').write_text("""window.BOUKEN_NOTE_DATA = window.BOUKEN_NOTE_DATA || {};
window.BOUKEN_NOTE_DATA.areas = {
  current: {
    id:'prototype_area',
    background:'images/backgrounds/battlefield_clean.webp',
    titleLogo:'images/ui/title_logo.webp'
  }
};
""", encoding='utf-8')

(ROOT/'js/main.js').write_text("""// Engine v1 bootstrap metadata only. Current gameplay remains in js/game.js during Phase 1.
window.BOUKEN_NOTE_ENGINE = Object.freeze({
  version: '1.0.0-phase1',
  source: 'v23.46 + PARTS_PHASE1',
  migrationStage: 'externalized-assets-and-source'
});
console.info('[BOUKEN NOTE] Engine v1 Phase 1 loaded');
""", encoding='utf-8')

# Package for StackBlitz / local Vite.
(ROOT/'package.json').write_text(json.dumps({
  'name':'bouken-note-engine-v1', 'private': True, 'version':'1.0.0', 'type':'module',
  'scripts': {'dev':'vite --host 0.0.0.0', 'build':'vite build', 'preview':'vite preview --host 0.0.0.0'},
  'devDependencies': {'vite':'^7.1.3'}
}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(ROOT/'.nojekyll').write_text('', encoding='utf-8')

# Asset manifest.
(ROOT/'assets-manifest.json').write_text(json.dumps({'assets':manifest}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

# Documentation.
readme = """# ぼうけんノート Engine v1

LiveCodes の1ファイル構成から、複数ファイル型の開発基盤へ移すための **Phase 1（厨房作成）** です。

## この版で完了したこと

- v23.46 原本を `legacy/` に凍結保存
- v23.46 + Parts Phase1 を実行母体として外部ファイル化
- HTML / CSS / JavaScript / 画像 / BGM / SE を分離
- Base64 埋め込み素材を実ファイルへ抽出
- StackBlitz / Vite でそのまま起動できる構成を追加
- 将来のデータ駆動化用に `data/` を用意

## 重要

**Phase 1 ではゲーム内容を変えないことを最優先にしています。**

現在の実戦ロジックは `js/game.js` に残っています。`data/*.js` は Phase 2 で順次、実戦ロジックの正本へ切り替えるための移行先です。まだ現在の戦闘処理を上書きしません。

## 起動

```bash
npm install
npm run dev
```

StackBlitz ではこのフォルダ（またはZIP）を JavaScript/Vite プロジェクトとして読み込んでください。

## フォルダ

- `index.html` : ゲーム画面
- `css/game.css` : 現行CSSを順序維持で外部化
- `js/game.js` : 現行の主要ゲームロジック
- `js/patch-*.js` : v23.46 の後段パッチ（実行順維持）
- `data/` : キャラ・敵・技・ミッション・エリアの移行先
- `images/` : 画像素材
- `sounds/` : BGM / SE
- `legacy/` : 凍結した原本
- `docs/` : 移行状況・次工程

## 次工程（Phase 2）

1. `CHARACTER_DEFS` を `data/characters.js` を正本に変更
2. 敵定義を `data/enemies.js` へ一本化
3. ミッション定義を `data/missions.js` へ一本化
4. `js/game.js` を `battle.js / missions.js / save.js / ui.js` に分割
5. 固定index依存をキャラクターID依存へ置換
6. 動作同等性確認後に v23.46 legacy adapter を縮小

以後は「コード全文を再生成」ではなく、対象ファイルだけを変更します。
"""
(ROOT/'README.md').write_text(readme, encoding='utf-8')

(ROOT/'docs/MIGRATION_STATUS.md').write_text("""# Migration Status

## Source of truth

- 上位仕様: ぼうけんノート 仕様書・ロードマップ v1.2
- 凍結実装: `legacy/BOUKEN_NOTE_v23_46_FROZEN.html`
- 現在の実行母体: v23.46 + Parts Phase1 を外部ファイル化した `index.html`

## Phase 1 — 完了

- [x] 原本凍結
- [x] HTML外部化
- [x] CSS外部化
- [x] JavaScript外部化
- [x] 画像ファイル化
- [x] BGM/SEファイル化
- [x] StackBlitz/Vite起動構成
- [x] データ層の移行先を作成

## Phase 2 — 次工程

- [ ] characters.js を実ランタイムへ接続
- [ ] enemies.js を実ランタイムへ接続
- [ ] skills.js を実ランタイムへ接続
- [ ] missions.js を実ランタイムへ接続
- [ ] battle / save / ui / missions の責務分割
- [ ] 固定index依存解消
- [ ] 同等性テスト

## ルール

Phase 2 の各変更は1機能ずつ行い、正常版へいつでも戻せる単位でコミットする。
""", encoding='utf-8')

(ROOT/'docs/STACKBLITZ.md').write_text("""# StackBlitz への移行手順

1. このプロジェクトZIPを展開する。
2. StackBlitzで新しい Vite / Vanilla JavaScript プロジェクトを作る。
3. プロジェクト内の初期ファイルを削除し、このフォルダ一式をアップロードする。
4. `npm install` が完了したら `npm run dev` を実行する。
5. Preview で `index.html` を確認する。

## GitHubへ保存するとき

このフォルダを1リポジトリとして保存する。`legacy/BOUKEN_NOTE_v23_46_FROZEN.html` は削除せず、移行前の復元点として残す。

## GitHub Pages

Phase 1は静的ファイルだけで動作するため、ビルド結果 `dist/` をPagesへ公開できる。まずはStackBlitz上で動作同等性を確認してから公開する。
""", encoding='utf-8')

# Write checksums and migration metadata.
meta = {
    'engineVersion':'1.0.0-phase1',
    'frozenSource': frozen_path.name,
    'frozenSha256': hashlib.sha256(frozen.encode('utf-8')).hexdigest(),
    'runtimeSource': phase1_path.name,
    'runtimeSourceSha256': hashlib.sha256(source.encode('utf-8')).hexdigest(),
    'extractedUniqueAssets': len(manifest),
    'runtimeScripts': script_files,
    'note':'Phase 1 externalization only; gameplay logic intentionally retained.'
}
(ROOT/'docs/build-info.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

# Copy migration tool into project.
shutil.copy2('/mnt/data/build_bouken_engine_v1.py', ROOT/'tools/extract_from_livecodes.py')

# Basic validation.
index = (ROOT/'index.html').read_text(encoding='utf-8')
assert 'data:image/' not in index and 'data:audio/' not in index
css = (ROOT/'css/game.css').read_text(encoding='utf-8')
# actual embedded base64 should be gone (regex source text can mention data:image generically)
assert not re.search(r'data:(?:image|audio)/[^;]+;base64,', css)
for jsf in script_files:
    txt=(ROOT/'js'/jsf).read_text(encoding='utf-8')
    assert not re.search(r'data:(?:image|audio)/[^;]+;base64,', txt)

# Report sizes.
print('created', ROOT)
print('unique assets', len(manifest))
print('index KB', (ROOT/'index.html').stat().st_size/1024)
print('css KB', (ROOT/'css/game.css').stat().st_size/1024)
print('game.js KB', (ROOT/'js/game.js').stat().st_size/1024)
print('legacy frozen MB', (ROOT/'legacy/BOUKEN_NOTE_v23_46_FROZEN.html').stat().st_size/1024/1024)
