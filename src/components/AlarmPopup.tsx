import { useEffect, useRef, useState } from 'react';
import type { AlarmPayload } from '../../shared/types';

export default function AlarmPopup({ payload }: { payload: unknown }) {
  const p = (payload ?? null) as AlarmPayload | null;
  const entry = p?.entry ?? null;
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let disposed = false;
    const startAudio = () => {
      const a = audioRef.current;
      if (a && a.paused) void a.play().catch(() => undefined);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.close();
    };
    window.addEventListener('pointerdown', startAudio);
    window.addEventListener('keydown', onKey);
    void (async () => {
      const url = (await window.api?.getAlarmUrl?.()) ?? '';
      if (disposed || !url) return;
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = Math.max(0, Math.min(1, p?.volume ?? 1));
      audioRef.current = audio;
      void audio.play().catch(() => {
        /* autoplay blocked — запустим по клику */
      });
    })();
    return () => {
      disposed = true;
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', onKey);
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = '';
      }
    };
  }, []);

  if (!entry) {
    return (
      <div className="alarm-root">
        <div className="alarm-head">Мой день</div>
        <div className="alarm-body">
          <p>Пустое уведомление.</p>
        </div>
        <div className="alarm-foot">
          <button className="btn" onClick={() => window.close()}>
            Ок
          </button>
        </div>
      </div>
    );
  }

  const headLabel = p?.test ? 'Тест' : entry.type === 'break' ? 'Перерыв' : entry.type === 'prayer' ? 'Намаз' : 'Напоминание';

  return (
    <div className={expanded ? 'alarm-root' : 'alarm-root collapsed'}>
      <div className="alarm-head">
        <span>BUZILNIK</span>
        <span>{headLabel}</span>
      </div>
      <div className="alarm-body">
        <div className="alarm-time">{entry.time}</div>
        <div className="alarm-title">{entry.title}</div>
        {expanded && (
          <>
            {entry.text && <div className="alarm-text">{entry.text}</div>}
            {entry.desc && <div className="alarm-text">{entry.desc}</div>}
          </>
        )}
        <button className="alarm-toggle hidden-when-collapsed-sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Свернуть' : 'Развернуть'}
        </button>
      </div>
      <div className="alarm-foot">
        <button className="alarm-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Свернуть' : 'Развернуть'}
        </button>
        <button className="btn" onClick={() => window.close()}>
          Ок
        </button>
      </div>
    </div>
  );
}