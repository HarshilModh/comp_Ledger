import React, { useState } from 'react';

const DEMO_AUDIT_QUESTION = 'How much did Trump pay in federal income taxes?';
const DEMO_AUDIT_ANSWER = `Donald Trump paid just $750 in federal income taxes in both 2016 and 2017. Tax records show he paid no income taxes at all in 10 of the previous 15 years, largely because he reported losing more money than he made. In 2018, Trump reported $47.4 million in losses from his golf courses and resort properties. His Doral resort in Miami reported losses of $162.3 million since 2012. Trump received $427.4 million through 2018 from his reality television career and licensing deals. He is personally responsible for loans and debts totaling $421 million, most coming due within four years. He has also been locked in a decade-long audit battle with the IRS over a $72.9 million tax refund he claimed in 2010.`;

const DEMO_DIFF_QUESTION = 'OpenAI launches GPT-5 with extended context and reasoning';
const DEMO_DIFF_ANSWER = `OpenAI has released GPT-5, its most capable model to date, featuring a 1 million token context window and a new chain-of-thought reasoning mode the company calls "deep think." The model scores 92.3% on the MMLU benchmark, compared to 86.4% for GPT-4o. OpenAI CEO Sam Altman said in a blog post that GPT-5 can handle full codebases in a single prompt. The model is available to ChatGPT Plus subscribers at $20 per month and via API at $15 per million input tokens. Unlike GPT-4, GPT-5 was trained on a synthetic data pipeline that OpenAI says reduces hallucination rates by 40% in internal evaluations. The model supports real-time web search and can cite sources inline.`;

export default function InputPanel({ onTrace, status }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [mode, setMode] = useState('audit');

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    onTrace(question, answer, mode);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isLoading = status === 'streaming';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      <div className="flex items-center justify-between">
        <div className="flex gap-xs p-xs rounded-xl" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
          {['audit', 'differentiate'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-md py-xs rounded-lg text-label-md font-medium transition-all capitalize ${
                mode === m
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
              style={mode === m ? { boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)' } : {}}
            >{m}</button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (mode === 'audit') {
              setQuestion(DEMO_AUDIT_QUESTION);
              setAnswer(DEMO_AUDIT_ANSWER);
            } else {
              setQuestion(DEMO_DIFF_QUESTION);
              setAnswer(DEMO_DIFF_ANSWER);
            }
          }}
          className="text-label-md text-primary hover:underline font-medium"
        >
          Load demo
        </button>
      </div>

      <div className="glass-input flex flex-col overflow-hidden" style={{ height: 140 }}>
        <div className="px-md py-xs border-b border-outline-variant flex justify-between items-center" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
          <span className="text-label-md font-bold text-on-surface">
            {mode === 'audit' ? 'Reader Question' : 'Topic or Headline'}
          </span>
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16, opacity: 0.5 }}>help_outline</span>
        </div>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none placeholder:text-on-surface-variant placeholder:opacity-50"
          placeholder={mode === 'audit' ? 'Enter the query to be analyzed...' : 'What is this article about?'}
        />
      </div>

      <div className="glass-input flex flex-col overflow-hidden" style={{ height: 200 }}>
        <div className="px-md py-xs border-b border-outline-variant flex justify-between items-center" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
          <span className="text-label-md font-bold text-on-surface">
            {mode === 'audit' ? 'AI Assistant Answer' : 'Article Draft'}
          </span>
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16, opacity: 0.5 }}>smart_toy</span>
        </div>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none placeholder:text-on-surface-variant placeholder:opacity-50 custom-scrollbar"
          placeholder={mode === 'audit' ? 'Input the generated response for scoring...' : 'Paste your article draft here...'}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !question.trim() || !answer.trim()}
        className="btn-primary w-full text-label-md flex items-center justify-center gap-sm"
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
