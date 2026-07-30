import React, { useState } from 'react';

const DEMO_QUESTION = 'How much did Trump pay in federal income taxes?';
const DEMO_ANSWER = `Donald Trump paid just $750 in federal income taxes in both 2016 and 2017. Tax records show he paid no income taxes at all in 10 of the previous 15 years, largely because he reported losing more money than he made. In 2018, Trump reported $47.4 million in losses from his golf courses and resort properties. His Doral resort in Miami reported losses of $162.3 million since 2012. Trump received $427.4 million through 2018 from his reality television career and licensing deals. He is personally responsible for loans and debts totaling $421 million, most coming due within four years.`;

const PRESET_QUESTIONS = [
  { icon: 'gavel', label: 'Trump taxes', q: 'How much did Trump pay in federal income taxes?' },
  { icon: 'vaccines', label: 'mRNA vaccines', q: 'Are mRNA COVID vaccines safe and effective?' },
  { icon: 'factory', label: 'IRA jobs', q: 'How many jobs has the Inflation Reduction Act created?' },
  { icon: 'groups', label: 'Border crossings', q: 'How many migrants crossed the US southern border in 2023?' },
  { icon: 'eco', label: 'Climate cost', q: 'What is the economic cost of climate change per year?' },
];

const AUTO_MODELS = [
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5', provider: 'Anthropic' },
  { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'us.amazon.nova-micro-v1:0', label: 'Nova Micro', provider: 'Amazon' },
  { id: 'us.amazon.nova-lite-v1:0', label: 'Nova Lite', provider: 'Amazon' },
  { id: 'us.meta.llama3-1-8b-instruct-v1:0', label: 'Llama 3.1 8B', provider: 'Meta' },
];

export default function InputPanel({ onTrace, status, generating }) {
  const [inputMode, setInputMode] = useState('auto');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [selectedModel, setSelectedModel] = useState(AUTO_MODELS[0].id);

  const isLoading = status === 'streaming';

  function handleSubmit(e) {
    e?.preventDefault();
    if (!question.trim()) return;
    if (inputMode === 'manual' && !answer.trim()) return;
    onTrace(question, answer, 'audit', inputMode === 'auto', inputMode === 'auto' ? selectedModel : null);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-xs p-xs rounded-xl" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
          <button
            type="button"
            onClick={() => setInputMode('auto')}
            className={`flex items-center gap-xs px-md py-xs rounded-lg text-label-md font-medium transition-all ${
              inputMode === 'auto' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
            style={inputMode === 'auto' ? { boxShadow: '0 2px 8px rgba(22,163,74,0.3)' } : {}}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
            Auto
          </button>
          <button
            type="button"
            onClick={() => setInputMode('manual')}
            className={`flex items-center gap-xs px-md py-xs rounded-lg text-label-md font-medium transition-all ${
              inputMode === 'manual' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
            style={inputMode === 'manual' ? { boxShadow: '0 2px 8px rgba(22,163,74,0.3)' } : {}}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit_note</span>
            Manual
          </button>
        </div>
        {inputMode === 'manual' && (
          <button
            type="button"
            onClick={() => { setQuestion(DEMO_QUESTION); setAnswer(DEMO_ANSWER); }}
            className="text-label-md text-primary hover:underline font-medium"
          >
            Load demo
          </button>
        )}
      </div>

      {/* Mode description */}
      <div className="flex items-start gap-sm px-md py-sm rounded-xl" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)' }}>
        <span className="material-symbols-outlined text-primary shrink-0 mt-px" style={{ fontSize: 14 }}>
          {inputMode === 'auto' ? 'auto_awesome' : 'edit_note'}
        </span>
        <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 12 }}>
          {inputMode === 'auto'
            ? 'Ask a question — the selected AI model generates an answer, then we trace every claim against the publisher corpus.'
            : 'Paste an existing AI-generated answer to audit. Use this when you already have a response you want to trace.'}
        </p>
      </div>

      {/* Preset questions — auto mode */}
      {inputMode === 'auto' && (
        <div>
          <p className="text-label-sm text-on-surface-variant font-semibold mb-xs" style={{ fontSize: 11 }}>Try a preset</p>
          <div className="flex flex-wrap gap-xs">
            {PRESET_QUESTIONS.map(p => (
              <button
                key={p.q}
                type="button"
                onClick={() => setQuestion(p.q)}
                className={`flex items-center gap-xs px-sm py-xs rounded-lg text-label-sm font-medium transition-all ${
                  question === p.q ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                style={{ border: `1px solid ${question === p.q ? 'var(--primary)' : 'var(--outline-variant)'}`, background: question === p.q ? 'var(--primary-fixed)' : 'transparent' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Question input */}
      <div className="glass-input flex flex-col overflow-hidden">
        <div className="px-md py-xs border-b border-outline-variant flex items-center gap-sm" style={{ background: 'rgba(22,163,74,0.03)' }}>
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>help_outline</span>
          <span className="text-label-md font-bold text-on-surface flex-1">Question</span>
          <span className="text-body-sm text-on-surface-variant opacity-40" style={{ fontSize: 10 }}>⌘↵ to run</span>
        </div>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className="px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none placeholder:text-on-surface-variant placeholder:opacity-50"
          placeholder="Enter a question or claim to fact-check…"
        />
      </div>

      {/* Answer textarea — manual only */}
      {inputMode === 'manual' && (
        <div className="glass-input flex flex-col overflow-hidden">
          <div className="px-md py-xs border-b border-outline-variant flex items-center gap-sm" style={{ background: 'rgba(22,163,74,0.03)' }}>
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>smart_toy</span>
            <span className="text-label-md font-bold text-on-surface flex-1">AI-Generated Answer</span>
          </div>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={6}
            className="px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none placeholder:text-on-surface-variant placeholder:opacity-50 custom-scrollbar"
            placeholder="Paste the AI-generated response to audit…"
          />
        </div>
      )}

      {/* Model selector — auto only */}
      {inputMode === 'auto' && (
        <div>
          <p className="text-label-sm text-on-surface-variant font-semibold mb-xs" style={{ fontSize: 11 }}>Model to ask</p>
          <div className="flex flex-wrap gap-xs">
            {AUTO_MODELS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedModel(m.id)}
                className={`flex items-center gap-xs px-sm py-xs rounded-lg text-label-sm font-medium transition-all ${
                  selectedModel === m.id ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                style={selectedModel === m.id
                  ? { background: 'linear-gradient(135deg, #16a34a, #14532d)', boxShadow: '0 2px 8px rgba(22,163,74,0.25)' }
                  : { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{selectedModel === m.id ? 'check' : 'smart_toy'}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !question.trim() || (inputMode === 'manual' && !answer.trim())}
        className="btn-primary w-full text-label-md flex items-center justify-center gap-sm"
        style={{ padding: '12px' }}
      >
        {isLoading ? (
          <>
            <span className="material-symbols-outlined live-pulse" style={{ fontSize: 18 }}>pending</span>
            {generating ? 'Generating answer…' : 'Tracing claims…'}
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {inputMode === 'auto' ? 'auto_awesome' : 'play_arrow'}
            </span>
            {inputMode === 'auto' ? 'Generate & Trace' : 'Trace Claims'}
          </>
        )}
      </button>
    </form>
  );
}
