import { useState } from 'react';
import { ADDRESSES, ADDRESS_MAP, EMPLOYEES, HEIGHTS, PERSONALITIES, PORTRAITS, STYLES } from '../content/world';
import { charLength } from '../game/initial';
import type { GameState, PersonalityId, ShopStyle } from '../game/types';
import type { Action } from '../game/types';
import { Chibi } from './Illustrations';

export function Onboarding({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const step = state.onboardingStep;
  return (
    <div className="scroll">
      {step === 'name' && <NameStep state={state} dispatch={dispatch} />}
      {step === 'style' && <StyleStep state={state} dispatch={dispatch} />}
      {step === 'address' && <AddressStep state={state} dispatch={dispatch} />}
      {step === 'owner' && <OwnerStep state={state} dispatch={dispatch} />}
      {step === 'staff' && <StaffStep dispatch={dispatch} />}
    </div>
  );
}

function NameStep({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const [name, setName] = useState(state.draft.shopName);
  const length = charLength(name);
  const ready = length >= 2 && length <= 12;
  return (
    <form
      className="hero"
      onSubmit={(event) => {
        event.preventDefault();
        dispatch({ type: 'CONFIRM_NAME', name });
      }}
    >
      <p className="tiny muted">震惊！我开了一家宠物店</p>
      <h1>给你的宠物店起个名字吧</h1>
      <label className="field">
        <span className="tiny">2 到 12 个字</span>
        <input value={name} placeholder="例如茸茸小屋" maxLength={12} autoFocus onChange={(event) => setName(event.target.value)} />
      </label>
      <p className="tiny muted">先起名字。装修、地址和店主，等名字定下来再出现。</p>
      {state.notice && <p className="reason">{state.notice}</p>}
      <div className="stack">
        <button className="btn primary" type="submit" disabled={!ready}>
          就叫这个
        </button>
        {!ready && <p className="tiny reason">再写几个字，店名需要 2 到 12 个字。</p>}
      </div>
    </form>
  );
}

function StyleStep({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  return (
    <div>
      <h2 className="screen-title">选一种店里的气质</h2>
      <p className="tiny muted">六种都免费，不消耗行动。墙面、布料和招牌会跟着变，房间还是这一间。</p>
      <div className="stack">
        {STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            className="style-card"
            aria-pressed={state.draft.style === style.id}
            onClick={() => dispatch({ type: 'SELECT_STYLE', style: style.id as ShopStyle })}
          >
            <strong>{style.name}</strong>
            <span className="swatches" aria-hidden="true">
              <i style={{ background: style.wall }} />
              <i style={{ background: style.wood }} />
              <i style={{ background: style.cloth }} />
              <i style={{ background: style.sign }} />
            </span>
            <span className="tiny">{style.text}</span>
          </button>
        ))}
      </div>
      <div className="stack">
        <button className="btn primary" type="button" disabled={!state.draft.style} onClick={() => dispatch({ type: 'CONFIRM_STYLE' })}>
          就用这个风格
        </button>
        {!state.draft.style && <p className="tiny reason">先点一张卡片。选风格不花钱。</p>}
      </div>
    </div>
  );
}

function AddressStep({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const address = state.draft.addressId ? ADDRESS_MAP[state.draft.addressId] : ADDRESSES[0]!;
  return (
    <div>
      <h2 className="screen-title">店址揭晓了</h2>
      <p className="tiny muted">四个地址机会相同。刷新不会重新抽取，也不消耗行动。</p>
      <article className="card">
        <h3 style={{ margin: '0 0 6px' }}>{address.name}</h3>
        <p>{address.trait}</p>
        <p className="tiny muted">{address.tendency}</p>
      </article>
      <div className="stack">
        <button className="btn primary" type="button" onClick={() => dispatch({ type: 'CONFIRM_ADDRESS' })}>
          就在这里开店
        </button>
      </div>
    </div>
  );
}

function OwnerStep({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const player = state.player;
  if (!player) return null;
  const length = charLength(player.name);
  return (
    <div>
      <h2 className="screen-title">这位是店主</h2>
      <p className="tiny muted">22 岁。名字、头像、身高和性格都可以改，不消耗行动。性格只带来一点点风格差别，每种都能把店照顾好。</p>
      <label className="field">
        店主名字
        <input value={player.name} maxLength={8} onChange={(event) => dispatch({ type: 'UPDATE_PLAYER', name: event.target.value })} />
      </label>
      <p className="tiny" style={{ marginTop: 12 }}>头像</p>
      <div className="portraits">
        {PORTRAITS.map((portrait) => (
          <button
            key={portrait.id}
            type="button"
            className="portrait-pick"
            aria-pressed={player.portraitId === portrait.id}
            onClick={() => dispatch({ type: 'UPDATE_PLAYER', portraitId: portrait.id })}
          >
            <Chibi look={portrait.look} label={portrait.hair} />
            <span className="tiny">{portrait.hair}<br />{portrait.outfit}</span>
          </button>
        ))}
      </div>
      <p className="tiny">性格</p>
      <div className="chips">
        {PERSONALITIES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            aria-pressed={player.personalityId === item.id}
            onClick={() => dispatch({ type: 'UPDATE_PLAYER', personalityId: item.id as PersonalityId })}
          >
            {item.name}
          </button>
        ))}
      </div>
      <p className="tiny muted">{PERSONALITIES.find((item) => item.id === player.personalityId)?.text}</p>
      <p className="tiny">身高</p>
      <div className="chips">
        {HEIGHTS.map((height) => (
          <button key={height} type="button" className="chip" aria-pressed={player.heightCm === height} onClick={() => dispatch({ type: 'UPDATE_PLAYER', heightCm: height })}>
            {height} cm
          </button>
        ))}
      </div>
      {state.notice && <p className="reason">{state.notice}</p>}
      <div className="stack">
        <button className="btn primary" type="button" disabled={length < 2 || length > 8} onClick={() => dispatch({ type: 'CONFIRM_OWNER' })}>
          确认店主
        </button>
      </div>
    </div>
  );
}

function StaffStep({ dispatch }: { dispatch: (action: Action) => void }) {
  return (
    <div>
      <h2 className="screen-title">三位店员已经排好班</h2>
      <p className="tiny muted">他们负责日常接待、喂食和清洁。你的五次行动，留给需要亲自决定的事。</p>
      <div className="stack">
        {Object.values(EMPLOYEES).map((employee) => (
          <article key={employee.id} className="person-card">
            <div className="inline">
              <Chibi className="mini-portrait" look={employee.look} label={employee.name} />
              <div>
                <strong>{employee.name} · {employee.role}</strong>
                <p className="tiny">{employee.age} 岁，{employee.lookText}</p>
                <p className="tiny">{employee.duty}</p>
                <p className="tiny muted">班次 {employee.shiftStart}–{employee.shiftEnd}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="stack">
        <button className="btn primary" type="button" onClick={() => dispatch({ type: 'START_BUSINESS' })}>
          打开店门
        </button>
      </div>
    </div>
  );
}
