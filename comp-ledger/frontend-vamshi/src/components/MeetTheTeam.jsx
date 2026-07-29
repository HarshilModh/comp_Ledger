import React from 'react';

/**
 * Meet the Developers page.
 * Displays team member cards with name, role, bio, and LinkedIn link.
 */

const developers = [
  {
    name: 'Vamshi Kumar Reddy Kovvuri',
    role: 'Backend Engineer, Agentic Systems',
    bio: 'I am a backend developer based in Jersey City, NJ. I hold an MS in Computer Science from Stevens Institute of Technology and have built production systems in Java, Spring Boot, and Python. On CoMP Ledger I work on the claim scoring engine and the backend services behind it. Outside of code, I write about AI and backend engineering on Medium and LinkedIn.',
    linkedin: 'https://www.linkedin.com/in/kvamshireddy',
    initials: 'VK',
  },
  {
    name: 'Harshil Chetankumar Modh',
    role: 'Full Stack Developer',
    bio: "I'm a Software Engineer specializing in Full-Stack and AI-driven systems, with a Master's in Computer Science from Stevens Institute of Technology. I enjoy building production-grade applications — real users, real performance constraints, and real scalability challenges.",
    linkedin: 'https://www.linkedin.com/in/harshil-modh-53a62a1a6/',
    initials: 'HM',
  },
];

export default function MeetTheTeam() {
  return (
    <div className="flex flex-col gap-lg">
      {/* Page Header */}
      <div className="text-center mb-md">
        <h2 className="text-headline-md font-black text-on-surface mb-sm">Meet the Developers</h2>
        <p className="text-body-md text-on-surface-variant max-w-xl mx-auto">
          The engineers behind CoMP Ledger — building forensic evidence tools that give publishers the proof they need.
        </p>
      </div>

      {/* Developer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg max-w-4xl mx-auto w-full">
        {developers.map((dev) => (
          <div key={dev.name} className="glass-card p-lg flex flex-col items-center text-center gap-md">
            {/* Avatar with initials */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--primary), #0a3320)',
                boxShadow: '0 4px 20px rgba(74, 222, 128, 0.2)',
              }}
            >
              <span className="text-headline-sm font-black" style={{ color: '#4ade80' }}>
                {dev.initials}
              </span>
            </div>

            {/* Name and role */}
            <div>
              <h3 className="text-title-md font-bold text-on-surface">{dev.name}</h3>
              <p className="text-label-md text-primary font-medium mt-xs">{dev.role}</p>
            </div>

            {/* Bio */}
            <p className="text-body-sm text-on-surface-variant leading-relaxed">{dev.bio}</p>

            {/* LinkedIn link */}
            <a
              href={dev.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-sm text-label-md text-on-surface-variant hover:text-primary transition-colors mt-auto pt-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
