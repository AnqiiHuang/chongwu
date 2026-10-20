import type { DecorSlot, Look, Weather } from '../game/types';
import type { StyleDef } from '../content/world';

export function Paw({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="15" rx="5" ry="4" fill={filled ? '#a8d5ba' : '#eadfce'} />
      <circle cx="6" cy="9" r="2" fill={filled ? '#a8d5ba' : '#eadfce'} />
      <circle cx="10" cy="6.5" r="2" fill={filled ? '#a8d5ba' : '#eadfce'} />
      <circle cx="14.5" cy="6.5" r="2" fill={filled ? '#a8d5ba' : '#eadfce'} />
      <circle cx="18" cy="9.5" r="2" fill={filled ? '#a8d5ba' : '#eadfce'} />
    </svg>
  );
}

function Hair({ look }: { look: Look }) {
  if (look.hairStyle === 'bun') {
    return (
      <g fill={look.hairColor}>
        <path d="M34 62c1-26 16-36 26-36s25 12 26 36c-8-10-16-14-26-14s-18 4-26 14z" />
        <circle cx="84" cy="38" r="11" />
      </g>
    );
  }
  if (look.hairStyle === 'curly') {
    return (
      <g fill={look.hairColor}>
        <circle cx="40" cy="48" r="12" />
        <circle cx="52" cy="34" r="13" />
        <circle cx="70" cy="32" r="13" />
        <circle cx="84" cy="46" r="12" />
        <path d="M36 58c4-16 14-24 24-24s22 8 26 24z" />
      </g>
    );
  }
  if (look.hairStyle === 'short') {
    return <path d="M34 60c2-24 16-32 26-32s24 8 26 32c-8-8-16-12-26-12s-18 4-26 12z" fill={look.hairColor} />;
  }
  return <path d="M32 70c0-30 14-42 28-42s28 12 28 42c-6-16-16-22-28-22s-22 6-28 22z" fill={look.hairColor} />;
}

export function ChibiShape({ look }: { look: Look }) {
  return (
    <g>
      <ellipse cx="60" cy="142" rx="26" ry="5" fill="rgba(75,64,54,0.1)" />
      <path d="M40 96c2 22 8 34 20 34s18-12 20-34c-6 6-12 8-20 8s-14-2-20-8z" fill="#f6efe6" />
      <path d="M38 98c0-10 8-16 22-16s22 6 22 16v24c0 10-10 16-22 16s-22-6-22-16z" fill={look.shirt} />
      <path d="M42 112h36v18c0 8-8 12-18 12s-18-4-18-12z" fill={look.apron} />
      <circle cx="60" cy="62" r="28" fill="#f6d3bd" />
      <Hair look={look} />
      <g className="blink">
        <circle cx="50" cy="64" r="2.2" fill="#4b4036" />
        <circle cx="72" cy="64" r="2.2" fill="#4b4036" />
      </g>
      <path d="M54 74c4 4 10 4 14 0" fill="none" stroke="#c4847a" strokeWidth="2" strokeLinecap="round" />
      {look.glasses && (
        <g fill="none" stroke="#4b4036" strokeWidth="2">
          <circle cx="50" cy="64" r="8" />
          <circle cx="72" cy="64" r="8" />
          <path d="M58 64h6" />
        </g>
      )}
    </g>
  );
}

export function Chibi({ look, label, className }: { look: Look; label: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 150" role="img" aria-label={label}>
      <ChibiShape look={look} />
    </svg>
  );
}

export function PetShape({ id }: { id: string }) {
  if (id === 'naipao') {
    return (
      <g>
        <ellipse cx="70" cy="108" rx="36" ry="8" fill="rgba(75,64,54,0.08)" />
        <g className="wag">
          <ellipse cx="108" cy="78" rx="16" ry="22" fill="#f4efe6" />
          <ellipse cx="112" cy="70" rx="10" ry="14" fill="#e7e2d8" />
        </g>
        <ellipse cx="62" cy="86" rx="34" ry="24" fill="#f7f1e8" />
        <circle cx="48" cy="58" r="22" fill="#f7f1e8" />
        <path d="M30 48l8-20 12 12z" fill="#d5dbe3" />
        <path d="M52 40l6-22 14 14z" fill="#d5dbe3" />
        <circle cx="42" cy="58" r="2.4" fill="#6f97bf" />
        <circle cx="56" cy="58" r="2.4" fill="#6f97bf" />
        <path d="M46 66c2 2 6 2 8 0" fill="none" stroke="#c9a498" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    );
  }
  if (id === 'doubao') {
    return (
      <g>
        <ellipse cx="70" cy="112" rx="40" ry="8" fill="rgba(75,64,54,0.08)" />
        <g className="wag">
          <path d="M108 70c16 4 18 20 8 28" fill="none" stroke="#e2b56a" strokeWidth="8" strokeLinecap="round" />
        </g>
        <ellipse cx="68" cy="86" rx="40" ry="22" fill="#e2b56a" />
        <ellipse cx="68" cy="96" rx="24" ry="12" fill="#fff8ef" />
        <path d="M34 86c-2 16 4 22 10 22h8V78z" fill="#e2b56a" />
        <path d="M92 86c2 16-4 22-10 22h-8V78z" fill="#e2b56a" />
        <rect x="40" y="100" width="8" height="14" rx="3" fill="#c49245" />
        <rect x="86" y="100" width="8" height="14" rx="3" fill="#c49245" />
        <circle cx="34" cy="62" r="20" fill="#e2b56a" />
        <path d="M18 48l6-24 16 16z" fill="#e2b56a" />
        <path d="M36 42l8-26 16 18z" fill="#e2b56a" />
        <ellipse cx="28" cy="70" rx="8" ry="6" fill="#fff8ef" />
        <circle cx="28" cy="62" r="2" fill="#4b4036" />
        <circle cx="40" cy="62" r="2" fill="#4b4036" />
        <ellipse cx="24" cy="70" rx="3" ry="2" fill="#4b4036" />
      </g>
    );
  }
  if (id === 'wuyun') {
    return (
      <g>
        <ellipse cx="70" cy="108" rx="32" ry="16" fill="#2f2a28" />
        <circle cx="48" cy="78" r="18" fill="#2f2a28" />
        <path d="M32 70l6-16 12 10z" fill="#2f2a28" />
        <path d="M46 66l8-16 10 10z" fill="#2f2a28" />
        <circle cx="42" cy="78" r="2" fill="#f6d88b" />
        <circle cx="54" cy="78" r="2" fill="#f6d88b" />
      </g>
    );
  }
  if (id === 'zhima') {
    return (
      <g>
        <ellipse cx="70" cy="100" rx="28" ry="16" fill="#f4efe6" />
        <ellipse cx="52" cy="86" rx="14" ry="12" fill="#f7f1e8" />
        <ellipse cx="44" cy="62" rx="6" ry="16" fill="#f4efe6" />
        <ellipse cx="60" cy="60" rx="6" ry="16" fill="#f4efe6" />
        <circle cx="48" cy="86" r="1.6" fill="#4b4036" />
        <circle cx="58" cy="86" r="1.6" fill="#4b4036" />
      </g>
    );
  }
  if (id === 'nuomi') {
    return (
      <g>
        <ellipse cx="70" cy="96" rx="22" ry="16" fill="#e7c9a8" />
        <circle cx="70" cy="78" r="14" fill="#f0d7b8" />
        <ellipse cx="60" cy="70" rx="5" ry="7" fill="#e7b8b0" />
        <ellipse cx="80" cy="70" rx="5" ry="7" fill="#e7b8b0" />
        <circle cx="65" cy="78" r="1.5" fill="#4b4036" />
        <circle cx="75" cy="78" r="1.5" fill="#4b4036" />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="72" cy="118" rx="34" ry="7" fill="rgba(75,64,54,0.08)" />
      <g className="wag">
        <path d="M98 92c16 8 18 22 4 26" fill="none" stroke="#e7a15a" strokeWidth="7" strokeLinecap="round" />
      </g>
      <ellipse cx="70" cy="96" rx="34" ry="24" fill="#e7a15a" />
      <ellipse cx="70" cy="106" rx="18" ry="11" fill="#fff8ef" />
      <circle cx="46" cy="74" r="22" fill="#e7a15a" />
      <path d="M28 66l6-18 14 12z" fill="#e7a15a" />
      <path d="M32 62l4-12 8 8z" fill="#f3c1b0" />
      <path d="M44 60l8-20 14 14z" fill="#e7a15a" />
      <path d="M50 56l6-12 8 10z" fill="#f3c1b0" />
      <path d="M36 64c6 4 12 4 16-1" fill="none" stroke="#c9843f" strokeWidth="2" strokeLinecap="round" />
      <path d="M36 76h8" stroke="#4b4036" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M52 76h8" stroke="#4b4036" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="46" cy="84" r="1.6" fill="#c4847a" />
      <path d="M42 88c3 3 7 3 10 0" fill="none" stroke="#c4847a" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

export function PetArt({ id, label }: { id: string; label: string }) {
  return (
    <svg viewBox="0 0 140 130" role="img" aria-label={label}>
      <PetShape id={id} />
    </svg>
  );
}

export function ShopScene({
  shopName,
  style,
  weather,
  warmLight,
  equipped,
  owner,
  staff,
}: {
  shopName: string;
  style: StyleDef;
  weather: Weather;
  warmLight: boolean;
  equipped: Record<DecorSlot, string | null>;
  owner: Look;
  staff: Look[];
}) {
  const cushion = equipped.window === 'window_cushion';
  const flowers = equipped.shelf === 'dried_flowers';
  const card = equipped.shelf === 'thank_card';
  const carpet = equipped.carpet === 'soft_carpet';
  const doorMat = equipped.door === 'door_mat';
  const flowerStand = equipped.door === 'flower_stand';
  const sky = weather === 'rain' ? '#d5e4ef' : weather === 'cloudy' ? '#efe6d8' : '#f8e7b2';
  const sign = [...shopName].length > 8 ? 11 : 14;
  return (
    <svg viewBox="0 0 390 280" role="img" aria-label={`${shopName}的店面，${weather === 'rain' ? '窗外在下雨' : '店里安安静静'}`}>
      <rect width="390" height="280" fill={style.wall} />
      <rect x="0" y="214" width="390" height="66" fill={carpet ? style.cloth : '#f3e6d4'} />
      <rect x="28" y="36" width="118" height="86" rx="8" fill={sky} />
      <rect x="28" y="36" width="118" height="86" rx="8" fill="none" stroke={style.wood} strokeWidth="6" />
      {weather === 'sunny' && <circle cx="108" cy="62" r="14" fill="#f6d88b" />}
      {weather === 'cloudy' && <ellipse cx="86" cy="70" rx="22" ry="10" fill="#fff" />}
      {weather === 'rain' && (
        <g className="rain" stroke="#b9d8e8" strokeWidth="2" strokeLinecap="round">
          {Array.from({ length: 8 }, (_, index) => (
            <line key={index} x1={40 + (index % 4) * 24} y1={48 + Math.floor(index / 4) * 24} x2={34 + (index % 4) * 24} y2={62 + Math.floor(index / 4) * 24} />
          ))}
        </g>
      )}
      <g className="breathe" transform="translate(34,12) scale(0.62)">
        <PetShape id="dahuang" />
      </g>
      <rect x="250" y="78" width="78" height="136" rx="6" fill="#f7f1e8" stroke={style.wood} strokeWidth="6" />
      <circle cx="312" cy="146" r="3" fill="#c4a574" />
      {doorMat && <ellipse cx="289" cy="228" rx="22" ry="7" fill="#e7c9a8" />}
      {flowerStand && (
        <g>
          <rect x="232" y="168" width="8" height="46" rx="2" fill={style.wood} />
          <circle cx="236" cy="162" r="8" fill="#f4b8a4" />
          <circle cx="228" cy="168" r="6" fill="#f6d88b" />
        </g>
      )}
      {warmLight && <ellipse cx="289" cy="214" rx="26" ry="8" fill="#f6d88b" opacity="0.85" />}
      <g transform="translate(214,8)">
        <rect x="0" y="18" width="150" height="36" rx="10" fill={style.sign} />
        <text x="75" y="42" textAnchor="middle" fill="#4b4036" fontSize={sign} fontFamily="Songti SC, Palatino, serif">
          {shopName}
        </text>
      </g>
      <rect x="168" y="150" width="92" height="46" rx="8" fill={style.wood} />
      <rect x="176" y="158" width="76" height="8" rx="3" fill={style.cloth} />
      <g transform="translate(176,92) scale(0.34)">
        <ChibiShape look={owner} />
      </g>
      {staff.slice(0, 2).map((look, index) => (
        <g key={index} transform={`translate(${300 + index * 36},118) scale(0.28)`}>
          <ChibiShape look={look} />
        </g>
      ))}
      <rect x="300" y="78" width="62" height="46" rx="6" fill={style.cloth} />
      {flowers && <circle cx="330" cy="92" r="10" fill="#f4b8a4" />}
      {card && <rect x="314" y="88" width="22" height="16" rx="3" fill="#fff" stroke="#f4b8a4" />}
      {cushion ? (
        <ellipse cx="92" cy="214" rx="28" ry="10" fill="#f4b8a4" />
      ) : (
        <rect x="70" y="206" width="44" height="10" rx="4" fill={style.cloth} />
      )}
      <g className="breathe" transform="translate(36,156) scale(0.46)">
        <PetShape id="naipao" />
      </g>
      <rect x="186" y="206" width="54" height="12" rx="4" fill="#e7d3c1" />
      <g className="breathe" transform="translate(168,150) scale(0.48)">
        <PetShape id="doubao" />
      </g>
    </svg>
  );
}
