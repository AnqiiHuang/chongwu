import { useState } from 'react';
import { DAHUANG_STEPS, FLORIST_STEPS, WUYUN_STEPS } from '../content/events';
import { CUSTOMERS, DECOR, EMPLOYEES, ITEMS, PETS, SERVICES, SLOT_LABEL, TRAIN_COSTS } from '../content/world';
import { availableQty, monthTotals, profitOf } from '../game/economy';
import { createNewGame } from '../game/initial';
import { parseGame } from '../game/save';
import { actionsLeft, dateLabel, onDuty, seasonOf, SEASON_LABEL, timeLabel, WEATHER_LABEL, xpToNext } from '../game/time';
import type { Action, ActionCategory, AdResult, GameState } from '../game/types';
import { readBackup } from '../services/storage';
import { Chibi, Paw, PetArt } from './Illustrations';
import { AssetSprite, OwnerPortrait, PixelShop, SpritePortrait, StandingSprite } from './sprites';
import { readShell, writeShell } from '../game/draft';
import { activeEmployees, dailyWage, isHireId, STAFF_FRAME } from '../game/roster';

const CATEGORIES: { id: ActionCategory; title: string; text: string }[] = [
  { id: 'customer', title: '接待来客', text: '咨询、护理预约和熟客的故事' },
  { id: 'care', title: '照顾小店', text: '陪伴、环境，以及店里的安静时刻' },
  { id: 'neighborhood', title: '街坊走走', text: '花店、医院公告和社区里的人' },
];

function money(value: number): string {
  return value.toLocaleString('zh-CN');
}

export function StatusBar({ state, onProfile }: { state: GameState; onProfile: () => void }) {
  const shop = state.shop;
  const calendar = state.calendar;
  const player = state.player;
  if (!shop || !calendar || !player) return null;
  const left = actionsLeft(state.actionIndex);
  return (
    <header className="status">
      <button className="avatar-btn" type="button" onClick={onProfile} aria-label="查看店主和员工">
        {player.appearance && <span className="avatar-crop"><OwnerPortrait appearance={player.appearance} size={64} label={player.name} /></span>}
      </button>
      <div>
        <div className="spread">
          <h1>{shop.name}</h1>
          <span>Lv.{shop.level}</span>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          {dateLabel(calendar)} · {SEASON_LABEL[seasonOf(calendar.month)]} · {WEATHER_LABEL[calendar.weather]} · {timeLabel(state.actionIndex)}
          {state.star2 ? ' · 二星' : state.star1 ? ' · 一星' : ''}
        </p>
        <div className="paws" aria-label={`还剩 ${left} 次行动`}>
          {Array.from({ length: 5 }, (_, index) => (
            <Paw key={index} filled={index < left} />
          ))}
        </div>
      </div>
    </header>
  );
}

export function HomeScreen({
  state,
  dispatch,
  onMetric,
}: {
  state: GameState;
  dispatch: (action: Action) => void;
  onMetric: (metric: 'popularity' | 'happiness' | 'community') => void;
}) {
  const shop = state.shop!;
  const calendar = state.calendar!;
  const duty = activeEmployees(state).filter((id) => onDuty(id, state.actionIndex));
  return (
    <div className="scroll">
      <div className="scene-wrap">
        <PixelShop
          styleId={shop.style}
          shopName={shop.name}
          weather={calendar.weather}
          appearance={state.player?.appearance ?? null}
          staffIds={duty}
          showPets
          warmLight={shop.warmLight}
        />
      </div>
      <p className="tiny muted">
        {state.actionIndex >= 5 ? '已经关门。' : duty.length ? `在岗：${duty.map((id) => EMPLOYEES[id]?.name).join('、')}` : '这个时段没有员工在班，店主看着店。'}
      </p>
      <div className="metrics">
        <MetricButton label="人气" value={shop.popularity} color="#a8d5ba" onClick={() => onMetric('popularity')} />
        <MetricButton label="幸福" value={shop.happiness} color="#f4b8a4" onClick={() => onMetric('happiness')} />
        <MetricButton label="羁绊" value={shop.community} color="#f6d88b" onClick={() => onMetric('community')} />
      </div>
      <p className="tiny muted">经验 {shop.xp} / {xpToNext(shop.level)}</p>
      {state.levelNote && <article className="note"><p>{state.levelNote}</p></article>}
      {!state.settings.audioPromptSeen && (
        <article className="note">
          <p>要听听店里很轻的音乐吗？不听也可以。</p>
          <div className="inline" style={{ marginTop: 8 }}>
            <button className="btn primary" type="button" onClick={() => dispatch({ type: 'SET_SETTINGS', music: true, sfx: true, audioPromptSeen: true })}>打开</button>
            <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'SET_SETTINGS', audioPromptSeen: true })}>先不用</button>
          </div>
        </article>
      )}
      <article className="note">
        <p className="tiny muted">今日便签</p>
        <p>{state.todayNote}</p>
        {state.prepared.neighborhood?.templateId.startsWith('florist_') && state.prepared.neighborhood.templateId !== 'florist_visit' && (
          <p className="tiny">街坊走走里，何芳和布丁的下一段已经准备好了。今天只接这一段。</p>
        )}
      </article>
      <div className="actions">
        {CATEGORIES.map((category) => (
          <button key={category.id} className="btn" type="button" onClick={() => dispatch({ type: 'OPEN_CATEGORY', category: category.id })}>
            <strong>{category.title}</strong>
            <span className="tiny muted">{category.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MetricButton({ label, value, color, onClick }: { label: string; value: number; color: string; onClick: () => void }) {
  return (
    <button className="metric" type="button" onClick={onClick}>
      <span className="tiny">{label}</span>
      <b>{value}</b>
      <span className="bar" aria-hidden="true"><span style={{ width: `${value}%`, background: color }} /></span>
    </button>
  );
}

export function EventScreen({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const event = state.activeEvent;
  if (!event) return null;
  const character = event.characterId ? CUSTOMERS[event.characterId] ?? EMPLOYEES[event.characterId] : null;
  const look = character && 'look' in character ? character.look : null;
  return (
    <>
      <div className="scroll">
        <div className="event-art">
          {event.characterId && isHireId(event.characterId) && (
            <SpritePortrait frameId={STAFF_FRAME[event.characterId].replace('.front', '.neutral')} size={120} label={EMPLOYEES[event.characterId]?.name ?? '店员'} />
          )}
          {look && !(event.characterId && isHireId(event.characterId)) && (
            <Chibi look={look} label={character && 'name' in character ? character.name : '人物'} />
          )}
          {event.petId && (['dahuang', 'naipao', 'doubao', 'wuyun', 'zhima', 'nuomi'].includes(event.petId) ? (
            <AssetSprite frameId={`${event.petId}.front`} height={84} label={PETS.find((pet) => pet.id === event.petId)?.name ?? '宠物'} />
          ) : (
            <PetArt id={event.petId} label={PETS.find((pet) => pet.id === event.petId)?.name ?? '宠物'} />
          ))}
        </div>
        <article className="event-card">
          {event.coach && <p className="tiny muted">{event.coach}</p>}
          <h2>{event.title}</h2>
          <p>{event.description}</p>
          {event.result && (
            <>
              <p style={{ marginTop: 10 }}>{event.result.text}</p>
              <ul className="changes">
                {event.result.changes.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </>
          )}
        </article>
      </div>
      <div className="dock">
        {event.result ? (
          <button className="btn primary" type="button" onClick={() => dispatch({ type: 'CONTINUE' })}>
            {state.actionIndex >= 5 ? '看今天的日报' : '回到店里'}
          </button>
        ) : (
          <>
            {event.choices.map((choice) => (
              <button
                key={choice.id}
                className="choice"
                type="button"
                disabled={!!choice.disabledReason}
                onClick={() => dispatch({ type: 'CHOOSE', choiceId: choice.id })}
              >
                <strong>{choice.label}</strong>
                <span className="preview tiny">{choice.preview}</span>
                {choice.disabledReason && <span className="reason tiny">{choice.disabledReason}</span>}
              </button>
            ))}
            <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'CANCEL_EVENT' })}>
              返回，不消耗行动
            </button>
          </>
        )}
      </div>
    </>
  );
}

export function SummaryScreen({
  state,
  dispatch,
  showAds,
  onAd,
}: {
  state: GameState;
  dispatch: (action: Action) => void;
  showAds: boolean;
  onAd: () => void;
}) {
  const ledger = state.dailyLedger;
  const shop = state.shop!;
  const profit = profitOf(ledger);
  const claimed = !!state.adGrantedDays[state.calendar?.dayId ?? '']?.day_end_bonus;
  return (
    <div className="scroll summary">
      <h2>今天也有人因为你，安心了一点</h2>
      {state.star2 && state.star2DayId === state.calendar?.dayId && <div className="seal">二星</div>}
      {!state.star2 && state.star1 && state.history.length === 1 && <div className="seal">一星</div>}
      <div className="scene-wrap">
        <PixelShop
          styleId={shop.style}
          shopName={shop.name}
          weather={state.calendar!.weather}
          appearance={state.player?.appearance ?? null}
          staffIds={activeEmployees(state).filter((id) => onDuty(id, state.actionIndex))}
          showPets
          warmLight={shop.warmLight}
        />
      </div>
      <p>{ledger.photoCaption}</p>
      <div className="stat-grid">
        <Stat label="等级" value={`Lv.${shop.level}`} />
        <Stat label="经验" value={`${shop.xp} / ${xpToNext(shop.level)}`} />
        <Stat label="营业额" value={money(ledger.revenue)} />
        <Stat label="直接成本" value={money(ledger.cogs)} />
        <Stat label="工资预提" value={money(ledger.wageAccrual)} />
        <Stat label="租金预提" value={money(ledger.rentAccrual)} />
        <Stat label="水电与耗材" value={money(ledger.utilities)} />
        <Stat label="经营利润" value={money(profit)} />
        <Stat label="客流 / 订单" value={`${ledger.visitors} / ${ledger.orders}`} />
        <Stat label="当日采购" value={money(ledger.purchases)} />
        <Stat label="订金" value={money(ledger.deposits)} />
        <Stat label="现金变化" value={money(shop.cash - ledger.cashAtStart)} />
      </div>
      {ledger.bonusCash > 0 && <p className="tiny">额外奖励 {money(ledger.bonusCash)}。这是测试发放，不算营业额。</p>}
      {ledger.wagePaid > 0 && <p className="tiny">今天发了工资 {money(ledger.wagePaid)}。</p>}
      {ledger.rentPaid > 0 && <p className="tiny">今天付了租金 {money(ledger.rentPaid)}。</p>}
      <p className="tiny muted">人气 {shop.popularity} · 幸福 {shop.happiness} · 羁绊 {shop.community} · 店铺金 {money(shop.cash)}</p>
      {profit < 0 && <p className="tiny">利润是负的也没关系。工资和租金先记在账上，动物的饭没有因此停掉。</p>}
      {state.calendar?.day === 30 && <MonthCard state={state} />}
      {state.star2 && <p className="tiny">二星纪念章会留着。人气、幸福和羁绊之后仍会自己变化。</p>}
      <div className="stack">
        <button className="btn primary" type="button" onClick={() => dispatch({ type: 'START_NEXT_DAY' })}>开启明天</button>
      </div>
      {showAds && (
        <section className="card ad-sheet">
          <p className="tiny">广告流程测试 · 不是真实收入</p>
          <p>看广告，额外领取 80 店铺金。不看也有今天的全部收益。</p>
          <button className="btn ghost" type="button" disabled={claimed || !!state.pendingAd} onClick={onAd}>
            {claimed ? '今天已经领过这次测试奖励' : '看广告，额外领取 80 店铺金'}
          </button>
          {claimed && <p className="tiny reason">同一个位置每天一次。关掉或失败都不会扣钱。</p>}
        </section>
      )}
    </div>
  );
}

function MonthCard({ state }: { state: GameState }) {
  const calendar = state.calendar;
  if (!calendar) return null;
  const month = monthTotals(state.history, calendar.year, calendar.month);
  if (month.days === 0) return null;
  return (
    <article className="note">
      <p>第{calendar.year}年 {calendar.month}月的月报</p>
      <p className="tiny">经营利润 {money(month.profit)}。这是收入减去成本、工资、租金和水电，不是口袋里的现金。</p>
      <p className="tiny">现金变化 {money(month.cash)}。采购、发薪和收租都会算在这里。</p>
      <p className="tiny muted">营业额 {money(month.revenue)} · 直接成本 {money(month.cogs)} · 工资预提 {money(month.wages)} · 租金预提 {money(month.rent)} · {month.days} 天</p>
      {calendar.year === 1 && calendar.month === 3 && calendar.day === 30 && <p className="tiny">第一章的三十天写完了。明天照常开门。</p>}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="card" style={{ marginTop: 0 }}><span className="tiny muted">{label}</span><strong style={{ display: 'block' }}>{value}</strong></div>;
}

export function PetsScreen({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const [open, setOpen] = useState<string | null>('dahuang');
  const [wiggle, setWiggle] = useState<string | null>(null);
  return (
    <div className="scroll">
      <h2 className="screen-title">店里的动物</h2>
      <p className="tiny muted">猫、狗、兔子和仓鼠各自待在自己的区域。打招呼不消耗行动，每只每天只记一次。还没入住的不会出现在这里。</p>
      <div className="stack">
        {PETS.filter((pet) => {
          const stats = state.pets[pet.id];
          return !!stats && (stats.present || !!state.storyFlags[`${pet.id}_known`] || (pet.id === 'wuyun' && !!state.storyFlags.wuyun_adopted));
        }).map((pet) => {
          const stats = state.pets[pet.id];
          if (!stats) return null;
          const away = !stats.present;
          const checked = state.checkedInPets.includes(pet.id);
          const diary = [...state.diaries].reverse().find((entry) => entry.petId === pet.id);
          return (
            <article key={pet.id} className="card" style={{ marginTop: 0 }}>
              <button className="btn" type="button" onClick={() => setOpen(open === pet.id ? null : pet.id)} style={{ boxShadow: 'none', padding: 0 }}>
                <div className="inline">
                  <span className={wiggle === pet.id ? 'wag' : undefined}><AssetSprite frameId={`${pet.id}.front`} height={72} label={pet.name} /></span>
                  <span>
                    <strong>{pet.name}</strong>
                    <span className="tiny muted" style={{ display: 'block' }}>{pet.species} · {pet.zone}</span>
                    <span className="tiny">{away ? '不在前厅' : stats.trust < 30 ? '还在观察你' : stats.energy < 40 ? '想休息' : '今天状态平稳'}</span>
                  </span>
                </div>
              </button>
              {open === pet.id && (
                <div>
                  <p>{pet.story}</p>
                  <p className="tiny">喜欢的事：{pet.likes}</p>
                  <p className="tiny">幸福 {stats.happiness} · 精力 {stats.energy} · 信任 {stats.trust} · 护理 {stats.care === 'ok' ? '正常' : stats.care === 'watch' ? '需要关注' : '已预约医院'}</p>
                  {away && <p className="tiny">已经离开前厅。回访时还会再见到，店里不把它当成售出的商品。</p>}
                  {diary && <p className="tiny">最近的手记：{diary.text}</p>}
                  {stats.present ? (
                    <button
                      className="btn peach"
                      type="button"
                      onClick={() => {
                        setWiggle(pet.id);
                        dispatch({ type: 'CHECKIN_PET', petId: pet.id });
                        window.setTimeout(() => setWiggle(null), 700);
                      }}
                    >
                      {checked ? '今天打过招呼了' : '今天打个招呼'}
                    </button>
                  ) : (
                    <p className="tiny reason">不在店里的这一天，不能打招呼。</p>
                  )}
                  {checked && <p className="tiny reason">重复点击只有动画，不会再加信任。</p>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function DecorScreen({
  state,
  dispatch,
  showAds,
  onAd,
}: {
  state: GameState;
  dispatch: (action: Action) => void;
  showAds: boolean;
  onAd: () => void;
}) {
  const shop = state.shop!;
  const claimed = !!state.adGrantedDays[state.calendar?.dayId ?? '']?.decor_materials;
  return (
    <div className="scroll">
      <h2 className="screen-title">布置</h2>
      <PixelShop styleId={shop.style} shopName={shop.name} weather={state.calendar?.weather ?? 'sunny'} appearance={null} staffIds={[]} showPets={false} warmLight={shop.warmLight} />
      <p className="tiny muted">房间跟着装修走。背景里的家具是画好的，买下的小东西记在下面，不重复付钱，也不消耗行动。</p>
      <div className="stack">
        {(Object.keys(SLOT_LABEL) as (keyof typeof SLOT_LABEL)[]).map((slot) => {
          const equipped = shop.equipped[slot];
          const decor = DECOR.find((item) => item.id === equipped);
          return (
            <div key={slot} className="slot">
              <strong>{SLOT_LABEL[slot]}</strong>
              <p className="tiny" style={{ margin: '4px 0' }}>{decor ? decor.name : '还空着，会跟着装修风格。'}</p>
              {decor && <p className="tiny muted">{decor.text}</p>}
            </div>
          );
        })}
      </div>
      <h3>可以买下</h3>
      <div className="stack">
        {DECOR.filter((decor) => decor.price > 0).map((decor) => {
          const owned = shop.ownedDecor.includes(decor.id);
          const locked = shop.level < decor.level;
          const poor = shop.cash < decor.price;
          const reason = owned ? '已经拥有，换上不用再付' : locked ? `到 Lv.${decor.level} 才能买` : poor ? `店铺金还差 ${decor.price - shop.cash}` : null;
          return (
            <button key={decor.id} className="btn" type="button" disabled={owned || locked || poor} onClick={() => dispatch({ type: 'BUY_DECOR', decorId: decor.id })}>
              <strong>{decor.name}</strong>
              <span className="tiny">{decor.price} 店铺金 · {SLOT_LABEL[decor.slot]}</span>
              {reason && <span className="tiny reason">{reason}</span>}
            </button>
          );
        })}
      </div>
      <h3>已经拥有</h3>
      <div className="stack">
        {shop.ownedDecor.map((id) => {
          const decor = DECOR.find((item) => item.id === id);
          if (!decor) return null;
          const equipped = shop.equipped[decor.slot] === id;
          return (
            <button key={id} className="btn" type="button" onClick={() => dispatch({ type: 'EQUIP_DECOR', decorId: id })}>
              <strong>{decor.name}</strong>
              <span className="tiny">{equipped ? '正在这个位置上' : `换到${SLOT_LABEL[decor.slot]}，不另外收费`}</span>
            </button>
          );
        })}
      </div>
      <article className="note">
        <p>门外暖灯 {shop.warmLight ? '会留到关门' : '现在是关着的'}。灯不要求员工一直在门外接客。</p>
        <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'TOGGLE_WARM_LIGHT' })}>
          {shop.warmLight ? '先把暖灯关掉' : '保留门外暖灯'}
        </button>
        <p className="tiny muted">连续七天的夜归故事还在后面的章节。</p>
      </article>
      <article className="card">
        <p>装饰布料 {shop.materials} 片。这一阶段还不能拿来制作，先收着。</p>
        {showAds ? (
          <>
            <button className="btn ghost" type="button" disabled={claimed} onClick={onAd}>
              {claimed ? '今天的布料测试奖励已领过' : '看广告，领取 3 片装饰布料'}
            </button>
            <p className="tiny reason">广告流程测试。以后也可以用店铺金获得布料。不看没有任何损失。</p>
          </>
        ) : (
          <p className="tiny muted">当前没有接入真实广告，所以这里不提供奖励入口。</p>
        )}
      </article>
    </div>
  );
}

export function JournalScreen({ state, dispatch }: { state: GameState; dispatch: (action: Action) => GameState }) {
  const [tab, setTab] = useState<'people' | 'diary' | 'report' | 'settings'>('people');
  const [confirmNew, setConfirmNew] = useState(false);
  const shop = state.shop!;
  return (
    <div className="scroll">
      <div className="tabs" role="tablist">
        {([
          ['people', '顾客'],
          ['diary', '手记'],
          ['report', '报表'],
          ['settings', '设置'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'people' && (
        <div className="stack">
          <p className="tiny muted">第二次见面会写下宠物名字和上次买过什么。确认过的偏好和禁忌，要到 Lv.2 才展开。</p>
          {Object.values(state.customers).map((customer) => {
            const info = CUSTOMERS[customer.id];
            if (!info) return null;
            const known = customer.visits >= 2;
            return (
              <article key={customer.id} className="card" style={{ marginTop: 0 }}>
                <strong>{customer.met ? info.name : '还没见过的街坊'}</strong>
                <p className="tiny">{customer.met ? info.role : '见面之后才会记下是谁。'}</p>
                {customer.met ? (
                  <>
                    <p className="tiny">来过 {customer.visits} 次 · 好感 {customer.affinity}</p>
                    {known ? (
                      <>
                        <p className="tiny">宠物：{info.pet}</p>
                        <p className="tiny">上次购买：{customer.lastPurchase ?? '还没有成交'}</p>
                      </>
                    ) : (
                      <p className="tiny reason">第二次见面再写宠物的名字和上次消费。</p>
                    )}
                    {shop.level >= 2 ? (
                      <>
                        <p className="tiny">偏好：{customer.preferences.length ? customer.preferences.join('；') : '还没有确认的偏好'}</p>
                        <p className="tiny">禁忌：{customer.taboo ?? '还没有确认的禁忌'}</p>
                      </>
                    ) : (
                      <p className="tiny reason">偏好和禁忌先记在店里，Lv.2 才在手账展开。</p>
                    )}
                  </>
                ) : (
                  <p className="tiny muted">还没有见面，不能提前知道需求和宠物。</p>
                )}
              </article>
            );
          })}
          <h3>服务价目</h3>
          {SERVICES.map((service) => (
            <p key={service.name} className="tiny">
              {service.name} {service.price} 店铺金
              {service.open ? ' · 会在接待时出现' : ` · 尚未开放，到 Lv.${service.level} 再做`}
            </p>
          ))}
        </div>
      )}
      {tab === 'diary' && (
        <div className="stack">
          <p className="tiny muted">这些是店主的观察和想象。宠物不会说话，也没有人能读心。</p>
          {state.diaries.length === 0 && <p>还没有手记。去宠物页打个招呼，就会留下今天的一条。</p>}
          {[...state.diaries].reverse().map((entry, index) => (
            <article key={`${entry.dayId}-${entry.petId}-${index}`} className="card" style={{ marginTop: 0 }}>
              <p className="tiny muted">{PETS.find((pet) => pet.id === entry.petId)?.name} · {entry.dayId}</p>
              <p>{entry.text}</p>
            </article>
          ))}
          {([
            ['花店与小贵宾', FLORIST_STEPS],
            ['大黄的窗边', DAHUANG_STEPS],
            ['乌云的新家', WUYUN_STEPS],
          ] as const).map(([title, steps]) => (
            <article key={title} className="note">
              <p>{title}</p>
              {steps.map((step, index) => {
                const done = !!state.storyFlags[step.id];
                const chainReady = steps.slice(0, index).every((item) => state.storyFlags[item.id]);
                const storyOpen = title !== '乌云的新家' || !!state.storyFlags.florist_stand;
                const current = !done && chainReady && storyOpen;
                return (
                  <p key={step.id} className="tiny">
                    {done ? '已写下' : current ? '接下来' : '还没到'} · {step.title}
                  </p>
                );
              })}
            </article>
          ))}
          <p className="tiny muted">每条故事在对应的入口一天只接一段。不看广告也能继续。</p>
          <article className="note">
            <p>一星：{state.star1 ? '开张日已经完成。' : '完成开张日就能拿到。'}</p>
            <p className="tiny">二星：{state.star2 ? '综合分、幸福和花店故事都已经达到，纪念章会留下。' : '需要综合分至少 35、幸福至少 70，并且写完花店与小贵宾。没到之前这里不会提前点亮。'}</p>
            {state.storyFlags.memory_photo && <p className="tiny">有客人连续五次被好好接待，合影记在这本手账里。</p>}
          </article>
        </div>
      )}
      {tab === 'report' && (
        <div className="stack">
          <article className="card" style={{ marginTop: 0 }}>
            <p>店铺金 {money(shop.cash)}</p>
            <p className="tiny">温暖印章 {shop.stamps ?? 0} · 应付工资 {money(shop.wagePayable)} · 应付租金 {money(shop.rentPayable)}</p>
            <p className="tiny muted">工资在每月 15 日发，租金在月底付。平时只是预提。</p>
          </article>
          <h3>库存</h3>
          <p className="tiny">每天开门自动补货，预算 {state.restock?.budget ?? 80} 店铺金。买东西不消耗行动。</p>
          <div className="inline">
            <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'SET_RESTOCK', budget: (state.restock?.budget ?? 80) - 20 })}>预算减 20</button>
            <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'SET_RESTOCK', budget: (state.restock?.budget ?? 80) + 20 })}>预算加 20</button>
          </div>
          {ITEMS.map((item) => {
            const day = state.calendar?.absoluteDay ?? 0;
            const qty = availableQty(state.inventory, item.id, day);
            const paused = state.restock?.paused.includes(item.id);
            const poor = shop.cash < item.price;
            return (
              <article key={item.id} className="card" style={{ marginTop: 0 }}>
                <strong>{item.name}</strong>
                <p className="tiny">现有 {qty} · {item.price} 店铺金{item.perishableDays ? ` · 保质 ${item.perishableDays} 天` : ''}</p>
                <button className="btn" type="button" disabled={poor} onClick={() => dispatch({ type: 'BUY_ITEM', itemId: item.id })}>
                  {poor ? `还差 ${item.price - shop.cash}，买不了` : `买 1${item.name.endsWith('绳') || item.name.endsWith('屋') ? '个' : '份'}`}
                </button>
                {item.restock ? (
                  <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'SET_RESTOCK', itemId: item.id })}>
                    {paused ? '自动补货已暂停，点一下恢复' : `低于 ${item.restock.min} 时自动补到 ${item.restock.target}`}
                  </button>
                ) : (
                  <p className="tiny muted">这件不自动补，需要时再买。</p>
                )}
              </article>
            );
          })}
          <p className="tiny muted">食品过期会在开门时取出，不会拿去卖。自动补货每天只做一次，预算用完就停。</p>
          {state.calendar && <MonthCard state={state} />}
          <h3>过去的日子</h3>
          {state.history.length === 0 && <p className="tiny">第一天还没结算。</p>}
          {[...state.history].reverse().map((day) => (
            <p key={day.dayId} className="tiny">{day.dateLabel} · 利润 {money(day.profit)} · 现金 {money(day.cashDelta)}</p>
          ))}
        </div>
      )}
      {tab === 'settings' && (
        <div className="stack">
          <button className="btn" type="button" onClick={() => dispatch({ type: 'SET_SETTINGS', music: !state.settings.music })}>
            音乐：{state.settings.music ? '开着' : '关着'}
          </button>
          <button className="btn" type="button" onClick={() => dispatch({ type: 'SET_SETTINGS', sfx: !state.settings.sfx })}>
            音效：{state.settings.sfx ? '开着' : '关着'}
          </button>
          <button className="btn" type="button" onClick={() => dispatch({ type: 'SET_SETTINGS', reduceMotion: !state.settings.reduceMotion })}>
            减少动态：{state.settings.reduceMotion ? '开着' : '关着'}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              dispatch({ type: 'SET_SETTINGS', replayIntro: true });
              writeShell(localStorage, { ...readShell(localStorage), replay: true, introSeen: false });
            }}
          >
            下次打开时重看开场
          </button>
          <button className="btn ghost" type="button" onClick={() => exportSave(state)}>导出存档</button>
          <label className="btn ghost">
            导入存档
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                const parsed = parseGame(await file.text());
                if (!parsed) {
                  dispatch({ type: 'SHOW_NOTICE', text: '这个文件不是可用的存档，原来的进度还在。' });
                  return;
                }
                dispatch({ type: 'IMPORT_SAVE', state: parsed });
              }}
            />
          </label>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              const backup = readBackup(localStorage);
              if (!backup) {
                dispatch({ type: 'SHOW_NOTICE', text: '还没有可用的备份。' });
                return;
              }
              dispatch({ type: 'IMPORT_SAVE', state: backup });
            }}
          >
            恢复上一份备份
          </button>
          {confirmNew ? (
            <>
              <p className="tiny">当前进度会先留在备份里，然后从起名重新开始。</p>
              <button className="btn peach" type="button" onClick={() => dispatch({ type: 'IMPORT_SAVE', state: createNewGame() })}>确认重新开始</button>
              <button className="btn ghost" type="button" onClick={() => setConfirmNew(false)}>还是留下这家店</button>
            </>
          ) : (
            <button className="btn ghost" type="button" onClick={() => setConfirmNew(true)}>开始新游戏</button>
          )}
          <p className="tiny muted">关掉页面不会把游戏时间往前推。</p>
        </div>
      )}
    </div>
  );
}

export function exportSave(state: GameState): void {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${state.shop?.name ?? '宠物店'}-存档.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function TrainButton({ state, employeeId, dispatch }: { state: GameState; employeeId: string; dispatch: (action: Action) => void }) {
  const shop = state.shop;
  const employee = state.employees[employeeId];
  if (!shop || !employee) return null;
  const cost = employee.skill < TRAIN_COSTS.length ? TRAIN_COSTS[employee.skill] : null;
  const onShift = !!state.calendar && onDuty(employeeId, state.actionIndex);
  let reason: string | null = null;
  if (shop.level < 5) reason = '到 Lv.5 才能培训。现在点它不会扣行动，也不会扣店铺金。';
  else if (employee.skill >= 3) reason = '这一阶段的熟练已经够了。实战次数够了也会自己往上走。';
  else if (employee.trainedToday) reason = '今天已经培训过。同一天不再同时做特殊服务。';
  else if (state.phase !== 'open' || state.actionIndex >= 5) reason = '现在不是能花掉行动的时候。';
  else if (!onShift) reason = '这个时段不在店里，培训等上班。';
  else if (cost !== null && cost !== undefined && shop.cash < cost) reason = `店铺金还差 ${cost - shop.cash}。`;
  return (
    <>
      <p className="tiny">熟练 {employee.skill} / 3 · 实战 {employee.practice ?? 0}{cost ? ` · 下一档 ${cost} 店铺金` : ''}</p>
      <button className="btn" type="button" disabled={!!reason} onClick={() => dispatch({ type: 'TRAIN_EMPLOYEE', employeeId })}>
        {employee.skill >= 3 ? '这一档已经学完' : '培训，用掉 1 次行动'}
      </button>
      {reason && <p className="tiny reason">{reason}</p>}
    </>
  );
}

export function ProfileSheet({ state, dispatch, onClose }: { state: GameState; dispatch: (action: Action) => void; onClose: () => void }) {
  const player = state.player;
  if (!player) return null;
  return (
    <div className="sheet-layer" role="dialog" aria-label="店主资料">
      <div className="sheet">
        <div className="inline">
          <span className="avatar-crop lg">{player.appearance && <OwnerPortrait appearance={player.appearance} size={168} label={player.name} />}</span>
          <div>
            <strong>{player.name}</strong>
            <p className="tiny">女性 · {player.age} 岁</p>
            <p className="tiny">{player.hair}，{player.outfit}</p>
          </div>
        </div>
        <h3>当班与培训</h3>
        <p className="tiny">每天预提工资 {dailyWage(state.employees)}。没入职的人不排班，也不领工资。</p>
        {Object.values(EMPLOYEES).map((employee) => {
          const hired = !!state.employees[employee.id];
          return (
            <article key={employee.id} className="card">
              {isHireId(employee.id) && <StandingSprite frameId={STAFF_FRAME[employee.id]} bodyHeight={150} label={employee.name} />}
              <strong>{employee.name} · {employee.role}</strong>
              <p className="tiny">{hired ? `${employee.shiftStart}–${employee.shiftEnd} · ${state.calendar && onDuty(employee.id, state.actionIndex) ? '现在在店里' : '这个时段不在班'}` : '还没入职。不会出现在店里，也不会替班。'}</p>
              {hired && <TrainButton state={state} employeeId={employee.id} dispatch={dispatch} />}
            </article>
          );
        })}
        <button className="btn primary" type="button" onClick={onClose}>回到店里</button>
      </div>
    </div>
  );
}

export function MetricSheet({ state, metric, onClose }: { state: GameState; metric: 'popularity' | 'happiness' | 'community'; onClose: () => void }) {
  const title = { popularity: '人气', happiness: '幸福', community: '羁绊' }[metric];
  const logs = state.metricLog[metric];
  return (
    <div className="sheet-layer" role="dialog" aria-label={title}>
      <div className="sheet">
        <h2 className="screen-title">{title}</h2>
        {logs.length === 0 && <p>还没有新的变化。</p>}
        {logs.map((line, index) => <p key={index}>{line}</p>)}
        <button className="btn primary" type="button" onClick={onClose}>知道了</button>
      </div>
    </div>
  );
}

export function AdSheet({ dev, onResult }: { dev: boolean; onResult: (result: AdResult) => void }) {
  return (
    <div className="sheet-layer" role="dialog" aria-label="广告流程测试">
      <div className="sheet ad-sheet">
        <p className="tiny">广告流程测试</p>
        {dev ? (
          <>
            <p>这里不是真实广告，也不会产生广告收入。请选择一种测试结果。</p>
            <div className="stack">
              <button className="btn primary" type="button" onClick={() => onResult('rewarded')}>完成，发放测试奖励</button>
              <button className="btn ghost" type="button" onClick={() => onResult('closed')}>提前关闭</button>
              <button className="btn ghost" type="button" onClick={() => onResult('unavailable')}>没有广告</button>
              <button className="btn ghost" type="button" onClick={() => onResult('failed')}>加载失败</button>
            </div>
          </>
        ) : (
          <>
            <p>当前环境没有广告。游戏会继续，不会扣钱，也不会卡在这一页。</p>
            <button className="btn primary" type="button" onClick={() => onResult('unavailable')}>继续游戏</button>
          </>
        )}
      </div>
    </div>
  );
}
