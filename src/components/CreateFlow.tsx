import { useEffect, useRef, useState } from 'react';
import {
  APRON_OPTIONS,
  DEFAULT_APPEARANCE,
  HAIR_OPTIONS,
  SHOE_OPTIONS,
  TOP_OPTIONS,
  partName,
} from '../content/appearance';
import { OPENING_URL, loadImage, preloadAll } from '../content/assets';
import { INTERIORS } from '../content/interiors';
import { ADDRESSES, EMPLOYEES, PERSONALITIES } from '../content/world';
import {
  DRAFT_KEY,
  draftHasProgress,
  emptyDraft,
  hireError,
  ownerNameError,
  parseDraft,
  readShell,
  shopNameError,
  writeShell,
  type ShellPref,
} from '../game/draft';
import { charLength } from '../game/initial';
import { WAGE_BY_ID, dailyWage, isHireId, STAFF_FRAME } from '../game/roster';
import type { AddressId, CreateStep, GameState, OnboardingDraft, PersonalityId, ShopStyle } from '../game/types';
import { exportSave } from './PlayScreens';
import { AssetSprite, OwnerDoll, StandingSprite } from './sprites';

const ORDER: CreateStep[] = ['SHOP_NAME', 'INTERIOR', 'LOCATION', 'OWNER', 'STAFF'];
const STEP_LABEL = ['店名', '装修', '店址', '店主', '伙伴'];

function saveDraft(draft: OnboardingDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 草稿写失败时不覆盖正式存档。
  }
}

export function CreateFlow({
  save,
  bootNote,
  onContinue,
  onCommit,
}: {
  save: GameState | null;
  bootNote: string | null;
  onContinue: () => void;
  onCommit: (draft: OnboardingDraft) => boolean;
}) {
  const [shell, setShell] = useState<ShellPref>(() => readShell(localStorage));
  const [draft, setDraft] = useState<OnboardingDraft>(() => parseDraft(localStorage.getItem(DRAFT_KEY)) ?? emptyDraft());
  const [phase, setPhase] = useState<'boot' | 'street' | 'replace' | CreateStep>('boot');
  const [opening, setOpening] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [clock, setClock] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [part, setPart] = useState<'hair' | 'top' | 'apron' | 'shoes'>('hair');
  const [view, setView] = useState<'in' | 'out'>('in');
  const lock = useRef(false);
  const reduced = shell.reduceMotion || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skipIntro = reduced || (shell.introSeen && !shell.replay);

  useEffect(() => {
    let cancel = false;
    setOpening('loading');
    loadImage(OPENING_URL)
      .then(() => {
        if (!cancel) setOpening('ready');
      })
      .catch(() => {
        if (!cancel) setOpening('error');
      });
    return () => {
      cancel = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (opening !== 'ready') return;
    void preloadAll();
  }, [opening]);

  useEffect(() => {
    if (opening !== 'ready' || phase !== 'boot') return;
    setPhase('street');
    setClock(skipIntro ? 1 : 0);
  }, [opening, phase, skipIntro]);

  useEffect(() => {
    if (phase !== 'street' || skipIntro) return;
    const started = performance.now();
    let frame = 0;
    let stop = false;
    const tick = (now: number) => {
      if (stop) return;
      const next = Math.min(1, (now - started) / 7000);
      setClock(next);
      if (next < 1) frame = window.requestAnimationFrame(tick);
      else {
        setShell((current) => {
          const nextShell = { ...current, introSeen: true, replay: false };
          writeShell(localStorage, nextShell);
          return nextShell;
        });
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      stop = true;
      window.cancelAnimationFrame(frame);
    };
  }, [phase, skipIntro]);

  useEffect(() => {
    if (ORDER.includes(phase as CreateStep)) saveDraft(draft);
  }, [draft, phase]);

  function skip() {
    setClock(1);
    const nextShell = { ...shell, introSeen: true, replay: false };
    setShell(nextShell);
    writeShell(localStorage, nextShell);
  }

  function update(partial: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setHint(null);
  }

  function go(step: CreateStep) {
    update({ step });
    setPhase(step);
    setView('in');
  }

  function back() {
    const index = ORDER.indexOf(phase as CreateStep);
    if (index <= 0) setPhase('street');
    else go(ORDER[index - 1]!);
  }

  function commit() {
    if (lock.current) return;
    const problem = shopNameError(draft.shopName.trim()) ?? ownerNameError(draft.ownerName.trim()) ?? hireError(draft.selectedEmployeeIds);
    if (problem || !draft.styleId || !draft.locationId) {
      setHint(problem ?? '还差装修或店址。');
      return;
    }
    lock.current = true;
    const ok = onCommit({ ...draft, shopName: draft.shopName.trim(), ownerName: draft.ownerName.trim(), step: 'STAFF' });
    if (!ok) lock.current = false;
  }

  if (opening === 'error') {
    return (
      <div className="scroll hero">
        <h1>街景没有载入</h1>
        <p>开场图没准备好。这不影响以后的存档，可以再试一次。</p>
        <button className="btn primary" type="button" onClick={() => setAttempt((value) => value + 1)}>重试</button>
      </div>
    );
  }
  if (phase === 'boot' || opening === 'loading') {
    return (
      <div className="scroll hero">
        <p className="tiny muted">正在准备街景</p>
        <h1>0 / 1</h1>
        <p>这一步只等开场图。装修和人物会在后面再载。</p>
      </div>
    );
  }
  if (phase === 'street') {
    return (
      <StreetTitle
        clock={clock}
        reduced={reduced}
        save={save}
        draft={draft}
        bootNote={bootNote}
        onSkip={skip}
        onContinue={onContinue}
        onCreate={() => {
          if (save) setPhase('replace');
          else go(draftHasProgress(draft) ? draft.step : 'SHOP_NAME');
        }}
        onResume={() => go(draft.step)}
        shell={shell}
        onShell={(next) => {
          setShell(next);
          writeShell(localStorage, next);
        }}
      />
    );
  }
  if (phase === 'replace' && save) {
    return (
      <div className="scroll">
        <h2 className="screen-title">创建新的宠物店</h2>
        <p>新店会换掉现在的「{save.shop?.name}」。确认前，原来的进度还在，也可以先导出。</p>
        <div className="stack">
          <button className="btn" type="button" onClick={() => exportSave(save)}>导出旧档</button>
          <button className="btn primary" type="button" onClick={() => go(draftHasProgress(draft) ? draft.step : 'SHOP_NAME')}>我已确认，开始新店</button>
          <button className="btn ghost" type="button" onClick={() => setPhase('street')}>先继续原来的店</button>
        </div>
      </div>
    );
  }

  const index = ORDER.indexOf(phase as CreateStep);
  return (
    <div className="scroll create-flow">
      <div className="progress" aria-label="创建进度">
        {STEP_LABEL.map((label, stepIndex) => (
          <span key={label} className={stepIndex === index ? 'now' : stepIndex < index ? 'done' : ''}>{label}</span>
        ))}
      </div>
      <button className="btn ghost" type="button" onClick={back}>上一步</button>
      {phase === 'SHOP_NAME' && (
        <NameStep
          name={draft.shopName}
          onChange={(shopName) => update({ shopName })}
          onNext={() => {
            const problem = shopNameError(draft.shopName.trim());
            if (problem) setHint(problem);
            else go('INTERIOR');
          }}
        />
      )}
      {phase === 'INTERIOR' && (
        <InteriorStep
          styleId={draft.styleId}
          shopName={draft.shopName.trim()}
          onPick={(styleId) => update({ styleId })}
          onNext={() => (draft.styleId ? go('LOCATION') : setHint('先选一种装修。'))}
        />
      )}
      {phase === 'LOCATION' && (
        <LocationStep
          styleId={draft.styleId}
          locationId={draft.locationId}
          view={view}
          onView={setView}
          onPick={(locationId) => update({ locationId })}
          onNext={() => (draft.locationId ? go('OWNER') : setHint('先选一个店址。'))}
        />
      )}
      {phase === 'OWNER' && (
        <OwnerStep
          draft={draft}
          part={part}
          onPart={setPart}
          onChange={update}
          onNext={() => {
            const problem = ownerNameError(draft.ownerName.trim());
            if (problem) setHint(problem);
            else go('STAFF');
          }}
        />
      )}
      {phase === 'STAFF' && (
        <StaffStep
          ids={draft.selectedEmployeeIds}
          onToggle={(id) => {
            const selected = draft.selectedEmployeeIds;
            if (selected.includes(id)) update({ selectedEmployeeIds: selected.filter((item) => item !== id) });
            else if (selected.length >= 2) setHint('已经选了两位。先取消一位，再选这一位。');
            else update({ selectedEmployeeIds: [...selected, id] });
          }}
          onCommit={commit}
        />
      )}
      {hint && <p className="reason">{hint}</p>}
    </div>
  );
}

function StreetTitle({
  clock,
  reduced,
  save,
  draft,
  bootNote,
  onSkip,
  onContinue,
  onCreate,
  onResume,
  shell,
  onShell,
}: {
  clock: number;
  reduced: boolean;
  save: GameState | null;
  draft: OnboardingDraft;
  bootNote: string | null;
  onSkip: () => void;
  onContinue: () => void;
  onCreate: () => void;
  onResume: () => void;
  shell: ShellPref;
  onShell: (pref: ShellPref) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 360, h: 460 });
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const measure = () => setBox({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const camera = streetCamera(clock, box);
  const title = clock >= 5.5 / 7;
  const buttons = clock >= 6.2 / 7;
  return (
    <div className="street-screen">
      <div className="street-stage" ref={stage}>
        <img
          src={OPENING_URL}
          alt=""
          style={{ width: camera.imgW, height: camera.imgH, transform: `translate(${camera.left}px, ${camera.top}px)`, opacity: camera.fade }}
        />
        {!reduced && <span className="street-glow" />}
        {clock < 1 && (
          <button className="btn ghost skip" type="button" onClick={onSkip}>跳过开场</button>
        )}
      </div>
      <div className="street-copy">
        {title && <h1>震惊！我开了一家宠物店</h1>}
        {title && <p>从一声门铃开始，把小店变成温暖的家。</p>}
        {bootNote && <p className="tiny">{bootNote}</p>}
        {buttons && (
          <div className="stack">
            {save && <button className="btn primary" type="button" onClick={onContinue}>继续经营</button>}
            {draftHasProgress(draft) && <button className="btn" type="button" onClick={onResume}>继续创建</button>}
            {!(draftHasProgress(draft) && !save) && (
              <button className="btn primary" type="button" onClick={onCreate}>{save ? '创建新的宠物店' : '开始创建我的宠物店'}</button>
            )}
            <button className="btn ghost" type="button" onClick={() => setSettings((value) => !value)}>设置</button>
          </div>
        )}
        {settings && (
          <div className="stack">
            <button className="btn" type="button" onClick={() => onShell({ ...shell, reduceMotion: !shell.reduceMotion })}>
              减少动态：{shell.reduceMotion ? '开着' : '关着'}
            </button>
            <button className="btn" type="button" onClick={() => onShell({ ...shell, replay: true, introSeen: false })}>
              下次进入时重看开场
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function streetCamera(progress: number, box: { w: number; h: number }) {
  const aspect = 2172 / 724;
  const fade = Math.min(1, progress / (0.8 / 7));
  const panStart = 0.8 / 7;
  const panEnd = 4.5 / 7;
  const zoomEnd = 5.5 / 7;
  const panT = progress <= panStart ? 0 : progress >= panEnd ? 1 : (progress - panStart) / (panEnd - panStart);
  const pan = panT * panT * (3 - 2 * panT);
  const zoomT = progress <= panEnd ? 0 : Math.min(1, (progress - panEnd) / (zoomEnd - panEnd));
  const zoom = 1.28 + 0.18 * (1 - Math.pow(1 - zoomT, 3));
  const imgH = box.h * zoom;
  const imgW = imgH * aspect;
  const focusX = 0.16 + (0.72 - 0.16) * pan;
  let left = box.w * 0.5 - focusX * imgW;
  let top = box.h * 0.4 - 0.55 * imgH;
  left = Math.min(0, Math.max(box.w - imgW, left));
  top = Math.min(0, Math.max(box.h - imgH, top));
  return { fade, imgW, imgH, left, top };
}

function NameStep({ name, onChange, onNext }: { name: string; onChange: (value: string) => void; onNext: () => void }) {
  const problem = name.trim() ? shopNameError(name.trim()) : '再写几个字，店名需要 2 到 12 个字。';
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <h2 className="screen-title">给你的宠物店起个名字吧</h2>
      <div className="sign-board"><span>{name.trim() || '店名'}</span></div>
      <label className="field">
        <span className="tiny">2 到 12 个字，示例茸茸小屋</span>
        <input value={name} placeholder="茸茸小屋" onChange={(event) => onChange(event.target.value)} />
      </label>
      <p className="tiny">现在 {charLength(name)} 个字。</p>
      {problem && name.length > 0 && <p className="reason">{problem}</p>}
      <button className="btn primary" type="submit" disabled={!!shopNameError(name.trim())}>就叫这个</button>
    </form>
  );
}

function InteriorStep({
  styleId,
  shopName,
  onPick,
  onNext,
}: {
  styleId: ShopStyle | null;
  shopName: string;
  onPick: (id: ShopStyle) => void;
  onNext: () => void;
}) {
  const current = INTERIORS.find((item) => item.styleId === styleId) ?? INTERIORS[0]!;
  return (
    <div>
      <h2 className="screen-title">选一种店里的气质</h2>
      <div className="preview-frame">
        <AssetSprite frameId={current.frameId} height={220} label={current.name} />
        <strong className="scene-sign">{shopName}</strong>
      </div>
      <p>{current.name}</p>
      <p className="tiny">{current.text}</p>
      <div className="style-grid">
        {INTERIORS.map((item) => (
          <button key={item.styleId} type="button" className="style-card" aria-pressed={styleId === item.styleId} onClick={() => onPick(item.styleId)}>
            <AssetSprite frameId={item.frameId} height={72} label={item.name} />
            <strong>{item.name}</strong>
            {styleId === item.styleId && <span className="tiny">已选中</span>}
          </button>
        ))}
      </div>
      <button className="btn primary" type="button" disabled={!styleId} onClick={onNext}>就用这个装修</button>
      {!styleId && <p className="tiny reason">先点一张有画面的卡片。六种都免费。</p>}
    </div>
  );
}

function LocationStep({
  styleId,
  locationId,
  view,
  onView,
  onPick,
  onNext,
}: {
  styleId: ShopStyle | null;
  locationId: AddressId | null;
  view: 'in' | 'out';
  onView: (view: 'in' | 'out') => void;
  onPick: (id: AddressId) => void;
  onNext: () => void;
}) {
  const current = ADDRESSES.find((item) => item.id === locationId) ?? null;
  const interior = INTERIORS.find((item) => item.styleId === styleId);
  return (
    <div>
      <h2 className="screen-title">选一个店址</h2>
      <p className="tiny muted">四种都可以走完故事。店址不改变已经选好的室内装修。</p>
      {current && (
        <>
          <div className="inline">
            <button className="btn ghost" type="button" aria-pressed={view === 'out'} onClick={() => onView('out')}>看店外</button>
            <button className="btn ghost" type="button" aria-pressed={view === 'in'} onClick={() => onView('in')}>看店里</button>
          </div>
          <div className="preview-frame">
            <AssetSprite
              frameId={view === 'in' && interior ? interior.frameId : `location.${current.id}`}
              height={180}
              label={view === 'in' ? interior?.name ?? current.name : current.name}
            />
          </div>
          <p>{current.name}</p>
          <p className="tiny">{current.trait}</p>
          <p className="tiny">优势：{current.advantage}</p>
          <p className="tiny">不足：{current.drawback}</p>
        </>
      )}
      <div className="stack">
        {ADDRESSES.map((item) => (
          <button key={item.id} type="button" className="style-card" aria-pressed={locationId === item.id} onClick={() => { onPick(item.id); onView('out'); }}>
            <AssetSprite frameId={`location.${item.id}`} height={84} label={item.name} />
            <strong>{item.name}</strong>
            <span className="tiny">{item.advantage}</span>
            {locationId === item.id && <span className="tiny">已选中</span>}
          </button>
        ))}
      </div>
      <button className="btn primary" type="button" disabled={!locationId} onClick={onNext}>就在这里开店</button>
    </div>
  );
}

function OwnerStep({
  draft,
  part,
  onPart,
  onChange,
  onNext,
}: {
  draft: OnboardingDraft;
  part: 'hair' | 'top' | 'apron' | 'shoes';
  onPart: (part: 'hair' | 'top' | 'apron' | 'shoes') => void;
  onChange: (partial: Partial<OnboardingDraft>) => void;
  onNext: () => void;
}) {
  const options = { hair: HAIR_OPTIONS, top: TOP_OPTIONS, apron: APRON_OPTIONS, shoes: SHOE_OPTIONS }[part];
  const selected = { hair: draft.appearance.hairId, top: draft.appearance.topId, apron: draft.appearance.apronId, shoes: draft.appearance.shoesId }[part];
  const key = { hair: 'hairId', top: 'topId', apron: 'apronId', shoes: 'shoesId' }[part] as keyof OnboardingDraft['appearance'];
  return (
    <div>
      <h2 className="screen-title">这位是店主</h2>
      <p className="tiny muted">22 岁。发型、上衣、围裙和鞋子分开选，换一件不会改掉另外三件。</p>
      <div className="doll-stage">
        <OwnerDoll appearance={draft.appearance} bodyHeight={300} label={draft.ownerName || '店主'} />
      </div>
      <label className="field">
        店主名字
        <input value={draft.ownerName} onChange={(event) => onChange({ ownerName: event.target.value })} />
      </label>
      <div className="chips">
        {(['hair', 'top', 'apron', 'shoes'] as const).map((id) => (
          <button key={id} type="button" className="chip" aria-pressed={part === id} onClick={() => onPart(id)}>
            {{ hair: '发型', top: '上衣', apron: '围裙', shoes: '鞋子' }[id]}
          </button>
        ))}
      </div>
      <div className="style-grid">
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            className="style-card"
            aria-pressed={selected === item.id}
            onClick={() => onChange({ appearance: { ...draft.appearance, [key]: item.id } })}
          >
            <AssetSprite frameId={item.id} height={64} label={item.name} />
            <strong>{item.name}</strong>
            {selected === item.id && <span className="tiny">已选中</span>}
          </button>
        ))}
      </div>
      <p className="tiny">性格</p>
      <div className="chips">
        {PERSONALITIES.map((item) => (
          <button key={item.id} type="button" className="chip" aria-pressed={draft.personalityId === item.id} onClick={() => onChange({ personalityId: item.id as PersonalityId })}>
            {item.name}
          </button>
        ))}
      </div>
      <p className="tiny muted">{PERSONALITIES.find((item) => item.id === draft.personalityId)?.text}</p>
      <div className="inline">
        <button
          className="btn ghost"
          type="button"
          onClick={() =>
            onChange({
              appearance: {
                hairId: HAIR_OPTIONS[Math.floor(Math.random() * HAIR_OPTIONS.length)]!.id,
                topId: TOP_OPTIONS[Math.floor(Math.random() * TOP_OPTIONS.length)]!.id,
                apronId: APRON_OPTIONS[Math.floor(Math.random() * APRON_OPTIONS.length)]!.id,
                shoesId: SHOE_OPTIONS[Math.floor(Math.random() * SHOE_OPTIONS.length)]!.id,
              },
            })
          }
        >
          随机搭配
        </button>
        <button className="btn ghost" type="button" onClick={() => onChange({ appearance: { ...DEFAULT_APPEARANCE } })}>恢复默认穿搭</button>
      </div>
      <p className="tiny">{partName(draft.appearance.hairId)} · {partName(draft.appearance.topId)} · {partName(draft.appearance.apronId)} · {partName(draft.appearance.shoesId)}</p>
      <button className="btn primary" type="button" onClick={onNext}>确认店主</button>
    </div>
  );
}

function StaffStep({
  ids,
  onToggle,
  onCommit,
}: {
  ids: string[];
  onToggle: (id: string) => void;
  onCommit: () => void;
}) {
  const wage = dailyWage(Object.fromEntries(ids.filter(isHireId).map((id) => [id, { id, skill: 0, practice: 0, trainedToday: false }])));
  return (
    <div>
      <h2 className="screen-title">选两位一起开店</h2>
      <p>已选择 {ids.length}/2。第三位先留在候选里，选满后再点会提示你先取消一位。</p>
      <div className="stack">
        {Object.values(EMPLOYEES).map((employee) => (
          <button key={employee.id} type="button" className="style-card" aria-pressed={ids.includes(employee.id)} onClick={() => onToggle(employee.id)}>
            <StandingSprite frameId={isHireId(employee.id) ? STAFF_FRAME[employee.id] : 'sutao.front'} bodyHeight={150} label={employee.name} />
            <strong>{employee.name} · {employee.role}</strong>
            <span className="tiny">{employee.age} 岁 · {employee.duty}</span>
            <span className="tiny">班次 {employee.shiftStart}–{employee.shiftEnd} · 每天预提 {isHireId(employee.id) ? WAGE_BY_ID[employee.id] : 0}</span>
            <span className="tiny">{ids.includes(employee.id) ? '已选中' : '候选'}</span>
          </button>
        ))}
      </div>
      <p className="tiny">两位一起，每天预提工资 {wage || '—'}。店主会补上没人做的基础接待。</p>
      <button className="btn primary" type="button" disabled={!!hireError(ids)} onClick={onCommit}>和伙伴们一起开店</button>
      {hireError(ids) && <p className="tiny reason">{hireError(ids)}</p>}
    </div>
  );
}
