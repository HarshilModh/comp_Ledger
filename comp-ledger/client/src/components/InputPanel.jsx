import React, { useState } from 'react';

const DEMO_QUESTION = 'How much did Trump pay in federal income taxes?';
const DEMO_ANSWER = `Donald Trump paid just $750 in federal income taxes in both 2016 and 2017. Tax records show he paid no income taxes at all in 10 of the previous 15 years, largely because he reported losing more money than he made. In 2018, Trump reported $47.4 million in losses from his golf courses and resort properties. His Doral resort in Miami reported losses of $162.3 million since 2012. Trump received $427.4 million through 2018 from his reality television career and licensing deals. He is personally responsible for loans and debts totaling $421 million, most coming due within four years. He has also been locked in a decade-long audit battle with the IRS over a $72.9 million tax refund he claimed in 2010.`;

export default function InputPanel({ onTrace, status }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [mode, setMode] = useState('audit');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    onTrace(question, answer, mode);
  };

  const isLoading = status === 'streaming';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-xs p-xs bg-surface-container rounded-lg border border-outline-variant">
          {['audit', 'differentiate'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-md py-xs rounded text-label-md font-medium transition-all capitalize ${
                mode === m
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >{m}</button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setQuestion(DEMO_QUESTION); setAnswer(DEMO_ANSWER); }}
          className="text-label-md text-primary hover:underline font-medium"
        >
          Load demo
        </button>
      </div>

      {/* Reader Question */}
      <div className="bg-surface border border-outline-variant rounded-lg flex flex-col overflow-hidden focus-within:border-primary-container transition-colors">
        <div className="px-sm py-xs bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
          <span className="text-label-md font-bold text-on-surface">
            {mode === 'audit' ? 'Reader Question' : 'Topic or Headline'}
          </span>
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>help_outline</span>
        </div>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          className="px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface placeholder:text-on-surface-variant placeholder:opacity-50"
          placeholder={mode === 'audit' ? 'Enter the query to be analyzed...' : 'What is this article about?'}
        />
      </div>

      {/* AI Answer */}
      <div className="bg-surface border border-outline-variant rounded-lg flex flex-col overflow-hidden focus-within:border-primary-container transition-colors">
        <div className="px-sm py-xs bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
          <span className="text-label-md font-bold text-on-surface">
            {mode === 'audit' ? 'AI Assistant Answer' : 'Article Draft'}
          </span>
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>smart_toy</span>
        </div>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          rows={5}
          className="px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none placeholder:text-on-surface-variant placeholder:opacity-50"
          style={{ maxHeight: 200 }}
          placeholder={mode === 'audit' ? 'Input the generated response for scoring...' : 'Paste your article draft here...'}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !question.trim() || !answer.trim()}
        className="w-full text-on-primary text-label-md font-bold rounded-xl hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-sm"
        style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #630ed4, #7c3aed)' }}
      >
        {isLoading ? (
          <>
            <span className="material-symbols-outlined live-pulse" style={{ fontSize: 18 }}>pending</span>
            Analyzing…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
            Run Analysis
          </>
        )}
      </button>
    </form>
  );
}
