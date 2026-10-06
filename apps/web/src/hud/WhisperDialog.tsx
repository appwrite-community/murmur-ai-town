import { useEffect, useRef, useState } from 'react';
import { sendWhisper } from '../lib/appwrite';
import { townActions, useTown } from '../lib/store';
import { EmoteIcon, WhisperIcon } from './icons';
import { Portrait } from './Portrait';

const MAX = 140;
const IDEAS = ['The baker is secretly a spy', 'There is treasure under the fountain', 'The mayor cannot swim'];

export function WhisperDialog() {
  const open = useTown((s) => s.whisperOpen);
  const resident = useTown((s) => (s.selectedId ? s.residents[s.selectedId] : null));
  const visitorId = useTown((s) => s.visitorId);
  const [text, setText] = useState('');
  const [sentId, setSentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const whisper = useTown((s) => (sentId ? s.whispers[sentId] : undefined));
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setSentId(null);
      setError(null);
      setTimeout(() => area.current?.focus(), 50);
    }
  }, [open, resident?.$id]);

  if (!open || !resident || !visitorId) return null;
  const first = resident.name.split(' ')[0];
  const status = whisper?.status ?? (sentId ? 'pending' : null);

  async function submit() {
    const clean = text.trim();
    if (!clean || sending || !resident || !visitorId) return;
    setSending(true);
    setError(null);
    try {
      const row = await sendWhisper(visitorId, resident.$id, clean);
      townActions.whisper(row);
      setSentId(row.$id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The whisper got lost.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="dialog-wrap" onClick={(e) => e.target === e.currentTarget && townActions.openWhisper(false)}>
      <div className="dialog panel" style={{ ['--accent' as string]: resident.color }} role="dialog" aria-label={`Whisper to ${first}`}>
        <div className="dialog-portrait"><Portrait resident={resident} size={96} /></div>
        <div className="dialog-main">
          <div className="dialog-name">Whisper to {first}</div>
          {!status && (
            <>
              <p className="dialog-hint">Lean in and tell {first} something. {first} might pass it on to friends.</p>
              <div className="whisper-box">
                <textarea
                  ref={area}
                  value={text}
                  maxLength={MAX}
                  rows={2}
                  placeholder={`“${IDEAS[resident.$id.length % IDEAS.length]}…”`}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                    if (e.key === 'Escape') townActions.openWhisper(false);
                  }}
                />
                <span className="whisper-count">{text.length}/{MAX}</span>
              </div>
              {error && <p className="dialog-error">{error}</p>}
              <div className="dialog-actions">
                <button className="btn btn-cream" onClick={() => townActions.openWhisper(false)}>Never mind</button>
                <button className="btn btn-pink" disabled={!text.trim() || sending} onClick={submit}>
                  <WhisperIcon size={20} /> Whisper
                </button>
              </div>
            </>
          )}
          {status === 'pending' && <p className="dialog-pending">{first} leans in to listen<span className="dots"><i /><i /><i /></span></p>}
          {status === 'heard' && (
            <>
              <div className="dialog-reply">
                {whisper?.emote && <EmoteIcon emote={whisper.emote} size={24} />}
                <span>“{whisper?.reply}”</span>
              </div>
              <p className="dialog-hint">{first} will remember it. Watch the Rumors tab to see who hears it next.</p>
              <div className="dialog-actions"><button className="btn btn-cream" onClick={() => townActions.openWhisper(false)}>Done</button></div>
            </>
          )}
          {status === 'rate_limited' && (
            <>
              <div className="dialog-reply muted-reply"><EmoteIcon emote="sleepy" size={24} /><span>{first} covers both ears. Too many whispers!</span></div>
              <p className="dialog-hint">Each visitor can whisper 3 times every 10 minutes. Try again later.</p>
              <div className="dialog-actions"><button className="btn btn-cream" onClick={() => townActions.openWhisper(false)}>Okay</button></div>
            </>
          )}
          {status === 'rejected' && (
            <>
              <div className="dialog-reply muted-reply"><EmoteIcon emote="shrug" size={24} /><span>{whisper?.reply || `${first} pretends not to hear that.`}</span></div>
              <p className="dialog-hint">{first} will not repeat it.</p>
              <div className="dialog-actions"><button className="btn btn-cream" onClick={() => townActions.openWhisper(false)}>Okay</button></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
