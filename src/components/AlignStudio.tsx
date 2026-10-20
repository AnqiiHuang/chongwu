import { useMemo, useState } from 'react';
import { APRON_OPTIONS, HAIR_OPTIONS, SHOE_OPTIONS, TOP_OPTIONS } from '../content/appearance';
import metrics from '../content/figure-metrics.json';
import { APRON_BOX, HAIR_BOX, MALE_SCALE, ORIGIN, SHOE_WIDTH, STAGE, TOP_BOX, rigConfig, type Box } from '../content/rig';
import type { Appearance } from '../game/types';
import { OwnerDoll, OwnerPortrait, SpritePortrait, StandingSprite, type RigDrawOptions } from './sprites';

interface FigureMetric {
  male: boolean;
}

const FIGURES = metrics as Record<string, FigureMetric>;
const FRONTS = Object.keys(FIGURES).filter((id) => id.endsWith('.front'));
const EXPRESSIONS = ['neutral', 'happy', 'worried', 'surprised', 'determined', 'sleepy'] as const;

type Kind = 'hair' | 'top' | 'apron' | 'shoes';

function copyText(value: string): void {
  void navigator.clipboard?.writeText(value);
}

export function AlignStudio() {
  const [appearance, setAppearance] = useState<Appearance>({
    hairId: HAIR_OPTIONS[0]!.id,
    topId: TOP_OPTIONS[0]!.id,
    apronId: APRON_OPTIONS[0]!.id,
    shoesId: SHOE_OPTIONS[0]!.id,
  });
  const [kind, setKind] = useState<Kind>('hair');
  const [dark, setDark] = useState(false);
  const [guides, setGuides] = useState(true);
  const [grid, setGrid] = useState(false);
  const [layers, setLayers] = useState<RigDrawOptions>({
    backHair: true,
    body: true,
    shoes: true,
    cuff: true,
    top: true,
    apron: true,
    frontHair: true,
  });
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [shoes, setShoes] = useState<Record<string, { width: number; dy: number }>>({});
  const [copied, setCopied] = useState(false);

  const currentId = { hair: appearance.hairId, top: appearance.topId, apron: appearance.apronId, shoes: appearance.shoesId }[kind];
  const baked = kind === 'hair' ? HAIR_BOX[currentId] : kind === 'top' ? TOP_BOX[currentId] : kind === 'apron' ? APRON_BOX[currentId] : null;
  const box = boxes[currentId] ?? baked ?? { x: 0, y: 0, w: 100, h: 100 };
  const shoe = shoes[currentId] ?? { width: SHOE_WIDTH[currentId] ?? 112, dy: 0 };

  const draw = useMemo<RigDrawOptions>(
    () => ({
      ...layers,
      boxes: {
        hair: boxes[appearance.hairId] ?? HAIR_BOX[appearance.hairId]!,
        top: boxes[appearance.topId] ?? TOP_BOX[appearance.topId]!,
        apron: boxes[appearance.apronId] ?? APRON_BOX[appearance.apronId]!,
      },
      shoeWidth: shoes[appearance.shoesId]?.width ?? SHOE_WIDTH[appearance.shoesId] ?? 112,
      shoeDy: shoes[appearance.shoesId]?.dy ?? 0,
    }),
    [layers, boxes, shoes, appearance],
  );

  function nudgeBox(partial: Partial<Box>): void {
    setBoxes((current) => ({ ...current, [currentId]: { ...box, ...partial } }));
  }

  function exportConfig(): void {
    const hair = { ...HAIR_BOX };
    const top = { ...TOP_BOX };
    const apron = { ...APRON_BOX };
    const shoeWidth = { ...SHOE_WIDTH };
    for (const [id, value] of Object.entries(boxes)) {
      if (id.startsWith('hair.')) hair[id] = value;
      if (id.startsWith('top.')) top[id] = value;
      if (id.startsWith('apron.')) apron[id] = value;
    }
    for (const [id, value] of Object.entries(shoes)) shoeWidth[id] = value.width;
    const payload = { ...rigConfig(), hair, top, apron, shoeWidth, shoeDy: shoes };
    copyText(JSON.stringify(payload, null, 2));
    setCopied(true);
  }

  const combos = grid
    ? HAIR_OPTIONS.flatMap((hair) =>
        TOP_OPTIONS.flatMap((top) =>
          APRON_OPTIONS.flatMap((apron) =>
            SHOE_OPTIONS.map((shoeOption) => ({
              hairId: hair.id,
              topId: top.id,
              apronId: apron.id,
              shoesId: shoeOption.id,
            })),
          ),
        ),
      )
    : [];

  return (
    <main className="align-studio" style={{ background: dark ? '#2a2622' : '#f6efe4', color: dark ? '#f6efe4' : '#24352c' }}>
      <h1>角色校准</h1>
      <p>只在开发地址出现。画布 {STAGE.w}×{STAGE.h}，身体原点 ({ORIGIN.x}, {ORIGIN.y})。男性站立身高是女性的 {MALE_SCALE} 倍。</p>
      <div className="chips">
        {(['hair', 'top', 'apron', 'shoes'] as const).map((id) => (
          <button key={id} type="button" className="chip" aria-pressed={kind === id} onClick={() => setKind(id)}>
            {{ hair: '发型', top: '上衣', apron: '围裙', shoes: '鞋子' }[id]}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={dark} onClick={() => setDark((value) => !value)}>深色底</button>
        <button type="button" className="chip" aria-pressed={guides} onClick={() => setGuides((value) => !value)}>定位线</button>
        <button type="button" className="chip" onClick={exportConfig}>{copied ? '已复制配置' : '复制当前配置'}</button>
      </div>
      <div className="align-layout">
        <div className="doll-stage" style={{ background: dark ? '#171412' : '#fff8ef' }}>
          <OwnerDoll appearance={appearance} bodyHeight={460} guides={guides} layers={draw} />
        </div>
        <div>
          <label className="field">当前部件
            <select value={currentId} onChange={(event) => setAppearance((current) => ({ ...current, [`${kind}Id`]: event.target.value }))}>
              {(kind === 'hair' ? HAIR_OPTIONS : kind === 'top' ? TOP_OPTIONS : kind === 'apron' ? APRON_OPTIONS : SHOE_OPTIONS).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          {kind !== 'shoes' && (
            <div className="stack">
              {(['x', 'y', 'w', 'h'] as const).map((key) => (
                <label key={key} className="field">{key} {box[key]}
                  <input type="range" min={key === 'x' || key === 'y' ? -120 : 40} max={key === 'w' || key === 'h' ? 700 : 700} value={box[key]} onChange={(event) => nudgeBox({ [key]: Number(event.target.value) })} />
                </label>
              ))}
            </div>
          )}
          {kind === 'shoes' && (
            <div className="stack">
              <label className="field">鞋宽 {shoe.width}
                <input type="range" min={70} max={180} value={shoe.width} onChange={(event) => setShoes((current) => ({ ...current, [currentId]: { ...shoe, width: Number(event.target.value) } }))} />
              </label>
              <label className="field">上下 {shoe.dy}
                <input type="range" min={-40} max={40} value={shoe.dy} onChange={(event) => setShoes((current) => ({ ...current, [currentId]: { ...shoe, dy: Number(event.target.value) } }))} />
              </label>
            </div>
          )}
          <div className="chips">
            {([
              ['backHair', '脑后发'],
              ['body', '身体'],
              ['shoes', '鞋子'],
              ['cuff', '裤脚'],
              ['top', '上衣'],
              ['apron', '围裙'],
              ['frontHair', '刘海'],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" className="chip" aria-pressed={layers[key] !== false} onClick={() => setLayers((current) => ({ ...current, [key]: current[key] === false }))}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <h2>同一套取景</h2>
      <div className="inline">
        <OwnerDoll appearance={appearance} bodyHeight={280} layers={draw} />
        <span className="avatar-crop lg"><OwnerPortrait appearance={appearance} size={168} /></span>
        <span className="avatar-crop"><OwnerPortrait appearance={appearance} size={64} /></span>
      </div>
      <h2>表情头像</h2>
      {['sutao', 'linxu', 'tangli', 'zhongyun', 'luning'].map((id) => (
        <div key={id} className="inline">
          {EXPRESSIONS.map((role) => (
            <SpritePortrait key={role} frameId={`${id}.${role}`} size={72} label={`${id} ${role}`} />
          ))}
        </div>
      ))}
      <h2>女性与男性身高</h2>
      <div className="lineup" style={{ background: dark ? '#171412' : '#fff8ef' }}>
        {FRONTS.filter((id) => !FIGURES[id]?.male).map((id) => (
          <StandingSprite key={id} frameId={id} bodyHeight={180} label={id} />
        ))}
        {FRONTS.filter((id) => FIGURES[id]?.male).map((id) => (
          <StandingSprite key={id} frameId={id} bodyHeight={180} label={id} />
        ))}
      </div>
      <button className="btn" type="button" onClick={() => setGrid((value) => !value)}>{grid ? '收起 256 种搭配' : '展开 256 种搭配'}</button>
      {grid && (
        <div className="combo-grid">
          {combos.map((combo) => (
            <OwnerDoll key={`${combo.hairId}-${combo.topId}-${combo.apronId}-${combo.shoesId}`} appearance={combo} bodyHeight={120} />
          ))}
        </div>
      )}
    </main>
  );
}
