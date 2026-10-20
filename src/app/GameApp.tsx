import { useCallback, useEffect, useRef, useState } from 'react';
import { CreateFlow } from '../components/CreateFlow';
import {
  AdSheet,
  DecorScreen,
  EventScreen,
  exportSave,
  HomeScreen,
  JournalScreen,
  MetricSheet,
  PetsScreen,
  ProfileSheet,
  StatusBar,
  SummaryScreen,
} from '../components/PlayScreens';
import { DRAFT_KEY, readShell } from '../game/draft';
import { createNewGame } from '../game/initial';
import { gameReducer } from '../game/reducer';
import { parseGame } from '../game/save';
import type { Action, AdPlacement, AdResult, GameState, OnboardingDraft } from '../game/types';
import {
  canStartRewarded,
  createRequestId,
  devAdService,
  emptyAdFrequency,
  normalizeFrequency,
  noteRewarded,
  rememberGameDay,
  resolveDevAd,
  shouldShowRewardEntry,
  type AdFrequency,
} from '../services/ads';
import { playChime, playPage, syncMusic, unlockAudio } from '../services/audio';
import { AD_KEY, loadGame, persistGame, SAVE_KEY } from '../services/storage';

type Tab = 'shop' | 'pets' | 'decor' | 'journal';
type Metric = 'popularity' | 'happiness' | 'community';

function readFreq(): AdFrequency {
  try {
    const raw = localStorage.getItem(AD_KEY);
    if (!raw) return emptyAdFrequency();
    const parsed = JSON.parse(raw) as AdFrequency;
    if (!parsed || !Array.isArray(parsed.seenGameDayIds)) return emptyAdFrequency();
    return parsed;
  } catch {
    return emptyAdFrequency();
  }
}

function writeFreq(freq: AdFrequency): void {
  try {
    localStorage.setItem(AD_KEY, JSON.stringify(freq));
  } catch {
    // 广告频控写失败时不打断游戏，也不重置已有存档。
  }
}

function loadInitial(): { state: GameState; note: string | null } {
  try {
    const loaded = loadGame(localStorage);
    if (!loaded) return { state: createNewGame(), note: null };
    if (loaded.source === 'backup') {
      return { state: loaded.state, note: '主存档读不出来，已改用上一份备份。损坏的内容没有被拿来覆盖进度。' };
    }
    return { state: loaded.state, note: null };
  } catch {
    return { state: createNewGame(), note: '读档失败。这一页没有删除浏览器里可能还在的旧存档。' };
  }
}

export function GameApp() {
  const initial = useState(loadInitial)[0];
  const formal = initial.state.shop ? initial.state : null;
  const [live, setLive] = useState<GameState | null>(null);
  const [bootNote, setBootNote] = useState(initial.note);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<GameState | null>(null);
  const [tab, setTab] = useState<Tab>('shop');
  const [profile, setProfile] = useState(false);
  const [metric, setMetric] = useState<Metric | null>(null);
  const ref = useRef<GameState | null>(live);
  ref.current = live;
  const showAds = shouldShowRewardEntry(import.meta.env.DEV, false);

  const dispatch = useCallback((action: Action): GameState => {
    const current = ref.current ?? createNewGame();
    const next = gameReducer(current, action);
    if (next === current) return next;
    ref.current = next;
    setLive(next);
    const saved = persistGame(localStorage, next);
    setSaveError(saved.ok ? null : saved.error);
    if (next.settings.sfx && (action.type === 'CHOOSE' || action.type === 'CHECKIN_PET')) playChime();
    if (next.settings.sfx && (action.type === 'OPEN_CATEGORY' || action.type === 'START_NEXT_DAY' || action.type === 'CONTINUE')) playPage();
    return next;
  }, []);

  function commitShop(draft: OnboardingDraft): boolean {
    const shell = readShell(localStorage);
    let next = gameReducer(createNewGame(), { type: 'BEGIN_SHOP', draft });
    if (!next.shop) return false;
    next = gameReducer(next, { type: 'SET_SETTINGS', reduceMotion: shell.reduceMotion, replayIntro: false });
    const saved = persistGame(localStorage, next);
    if (!saved.ok) {
      setSaveError(saved.error);
      return false;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // 正式档已经写下。草稿留着也不会覆盖它。
    }
    ref.current = next;
    setLive(next);
    setSaveError(null);
    return true;
  }

  useEffect(() => {
    const onPointer = () => unlockAudio();
    window.addEventListener('pointerdown', onPointer);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SAVE_KEY || !event.newValue) return;
      const parsed = parseGame(event.newValue);
      if (parsed && ref.current && parsed.revision > ref.current.revision) setConflict(parsed);
    };
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const current = normalizeFrequency(readFreq(), Date.now());
      writeFreq({ ...current, foregroundMs: current.foregroundMs + 15000 });
    }, 15000);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    syncMusic(!!live && live.settings.music && live.phase !== 'onboarding');
  }, [live]);

  useEffect(() => {
    if (!live?.calendar) return;
    writeFreq(rememberGameDay(readFreq(), live.calendar.dayId, Date.now()));
  }, [live?.calendar?.dayId]);

  function requestAd(placement: Extract<AdPlacement, 'day_end_bonus' | 'decor_materials'>): void {
    const gate = canStartRewarded(readFreq(), Date.now());
    if (!gate.ok) {
      dispatch({ type: 'SHOW_NOTICE', text: gate.reason });
      return;
    }
    const requestId = createRequestId();
    const next = dispatch({ type: 'BEGIN_AD', placement, requestId });
    if (next.pendingAd?.requestId !== requestId) return;
    void devAdService.showRewarded(placement, requestId);
  }

  function finishAd(result: AdResult): void {
    const pending = ref.current?.pendingAd;
    if (!pending) return;
    resolveDevAd(pending.requestId, result);
    const next = dispatch({ type: 'RESOLVE_AD', result });
    if (result === 'rewarded' && next.rewardClaims[pending.requestId]?.granted) {
      writeFreq(noteRewarded(readFreq(), Date.now()));
    }
  }

  const nav = (
    <nav className="nav" aria-label="店铺导航">
      {([
        ['shop', '营业'],
        ['pets', '宠物'],
        ['decor', '布置'],
        ['journal', '手账'],
      ] as const).map(([id, label]) => (
        <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setProfile(false); setMetric(null); }}>
          {label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="desk">
      <aside className="aside">
        <h1>震惊！我开了一家宠物店</h1>
        <p>每天五次行动。把窗边、门口和街坊慢慢照顾热。</p>
      </aside>
      <div className="phone" data-style={live?.shop?.style ?? 'japanese_wood'} data-motion={live?.settings.reduceMotion || readShell(localStorage).reduceMotion ? 'reduce' : 'ok'}>
        {!live ? (
          <CreateFlow
            save={formal}
            bootNote={bootNote ?? saveError}
            onContinue={() => {
              if (!formal) return;
              const saved = persistGame(localStorage, formal);
              setSaveError(saved.ok ? null : saved.error);
              if (saved.ok) setLive(formal);
            }}
            onCommit={commitShop}
          />
        ) : (
          <>
        {(bootNote || saveError || live.notice || conflict) && (
          <div className="banner">
            {bootNote && <p>{bootNote}</p>}
            {saveError && <p>{saveError}</p>}
            {live.notice && <p>{live.notice}</p>}
            {conflict && <p>另一个页面写入了更新的进度。</p>}
            <div className="inline" style={{ marginTop: 8 }}>
              {live.notice && <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'CLEAR_NOTICE' })}>知道了</button>}
              {bootNote && <button className="btn ghost" type="button" onClick={() => setBootNote(null)}>好</button>}
              {saveError && <button className="btn ghost" type="button" onClick={() => exportSave(live)}>导出当前进度</button>}
              {conflict && <button className="btn primary" type="button" onClick={() => { dispatch({ type: 'IMPORT_SAVE', state: conflict }); setConflict(null); }}>读取最新</button>}
            </div>
          </div>
        )}
            <StatusBar state={live} onProfile={() => setProfile(true)} />
            {live.phase === 'event' || live.phase === 'result' ? (
              <EventScreen state={live} dispatch={dispatch} />
            ) : live.phase === 'summary' ? (
              <SummaryScreen state={live} dispatch={dispatch} showAds={showAds} onAd={() => requestAd('day_end_bonus')} />
            ) : tab === 'pets' ? (
              <PetsScreen state={live} dispatch={dispatch} />
            ) : tab === 'decor' ? (
              <DecorScreen state={live} dispatch={dispatch} showAds={showAds} onAd={() => requestAd('decor_materials')} />
            ) : tab === 'journal' ? (
              <JournalScreen state={live} dispatch={dispatch} />
            ) : (
              <HomeScreen state={live} dispatch={dispatch} onMetric={setMetric} />
            )}
            {live.phase === 'open' && nav}
          </>
        )}
        {live && profile && <ProfileSheet state={live} dispatch={dispatch} onClose={() => setProfile(false)} />}
        {live && metric && <MetricSheet state={live} metric={metric} onClose={() => setMetric(null)} />}
        {live?.pendingAd && <AdSheet dev={showAds} onResult={finishAd} />}
      </div>
    </div>
  );
}
