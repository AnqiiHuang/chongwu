import { useCallback, useEffect, useRef, useState } from 'react';
import { Onboarding } from '../components/Onboarding';
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
import { createNewGame } from '../game/initial';
import { gameReducer } from '../game/reducer';
import { parseGame } from '../game/save';
import type { Action, AdPlacement, AdResult, GameState } from '../game/types';
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
  const [state, setState] = useState(initial.state);
  const [bootNote, setBootNote] = useState(initial.note);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<GameState | null>(null);
  const [tab, setTab] = useState<Tab>('shop');
  const [profile, setProfile] = useState(false);
  const [metric, setMetric] = useState<Metric | null>(null);
  const ref = useRef(state);
  ref.current = state;
  const showAds = shouldShowRewardEntry(import.meta.env.DEV, false);

  const dispatch = useCallback((action: Action): GameState => {
    const next = gameReducer(ref.current, action);
    if (next === ref.current) return next;
    ref.current = next;
    setState(next);
    const saved = persistGame(localStorage, next);
    setSaveError(saved.ok ? null : saved.error);
    if (next.settings.sfx && (action.type === 'CHOOSE' || action.type === 'START_BUSINESS' || action.type === 'CHECKIN_PET')) playChime();
    if (next.settings.sfx && (action.type === 'OPEN_CATEGORY' || action.type === 'START_NEXT_DAY' || action.type === 'CONTINUE')) playPage();
    return next;
  }, []);

  useEffect(() => {
    const saved = persistGame(localStorage, ref.current);
    setSaveError(saved.ok ? null : saved.error);
    const onPointer = () => unlockAudio();
    window.addEventListener('pointerdown', onPointer);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SAVE_KEY || !event.newValue) return;
      const parsed = parseGame(event.newValue);
      if (parsed && parsed.revision > ref.current.revision) setConflict(parsed);
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
    syncMusic(state.settings.music && state.phase !== 'onboarding');
  }, [state.settings.music, state.phase]);

  useEffect(() => {
    if (!state.calendar) return;
    writeFreq(rememberGameDay(readFreq(), state.calendar.dayId, Date.now()));
  }, [state.calendar?.dayId]);

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
    const pending = ref.current.pendingAd;
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
      <div className="phone" data-style={state.shop?.style ?? 'wood'} data-motion={state.settings.reduceMotion ? 'reduce' : 'ok'}>
        {(bootNote || saveError || state.notice || conflict) && state.phase !== 'onboarding' && (
          <div className="banner">
            {bootNote && <p>{bootNote}</p>}
            {saveError && <p>{saveError}</p>}
            {state.notice && <p>{state.notice}</p>}
            {conflict && <p>另一个页面写入了更新的进度。</p>}
            <div className="inline" style={{ marginTop: 8 }}>
              {state.notice && <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'CLEAR_NOTICE' })}>知道了</button>}
              {bootNote && <button className="btn ghost" type="button" onClick={() => setBootNote(null)}>好</button>}
              {saveError && <button className="btn ghost" type="button" onClick={() => exportSave(state)}>导出当前进度</button>}
              {conflict && <button className="btn primary" type="button" onClick={() => { dispatch({ type: 'IMPORT_SAVE', state: conflict }); setConflict(null); }}>读取最新</button>}
            </div>
          </div>
        )}
        {state.phase === 'onboarding' ? (
          <>
            {state.notice && state.onboardingStep !== 'name' && state.onboardingStep !== 'owner' && (
              <div className="banner"><p>{state.notice}</p></div>
            )}
            <Onboarding state={state} dispatch={dispatch} />
          </>
        ) : (
          <>
            <StatusBar state={state} onProfile={() => setProfile(true)} />
            {state.phase === 'event' || state.phase === 'result' ? (
              <EventScreen state={state} dispatch={dispatch} />
            ) : state.phase === 'summary' ? (
              <SummaryScreen state={state} dispatch={dispatch} showAds={showAds} onAd={() => requestAd('day_end_bonus')} />
            ) : tab === 'pets' ? (
              <PetsScreen state={state} dispatch={dispatch} />
            ) : tab === 'decor' ? (
              <DecorScreen state={state} dispatch={dispatch} showAds={showAds} onAd={() => requestAd('decor_materials')} />
            ) : tab === 'journal' ? (
              <JournalScreen state={state} dispatch={dispatch} />
            ) : (
              <HomeScreen state={state} dispatch={dispatch} onMetric={setMetric} />
            )}
            {state.phase === 'open' && nav}
          </>
        )}
        {profile && <ProfileSheet state={state} dispatch={dispatch} onClose={() => setProfile(false)} />}
        {metric && <MetricSheet state={state} metric={metric} onClose={() => setMetric(null)} />}
        {state.pendingAd && <AdSheet dev={showAds} onResult={finishAd} />}
      </div>
    </div>
  );
}
