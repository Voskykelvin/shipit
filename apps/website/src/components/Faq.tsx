import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const questions = [
  ['How do I start?', 'Request a proposal with your expected order volume and services. The team can then confirm scope, availability, pricing, and onboarding steps.'],
  ['Can customers track a delivery?', 'Yes. A generated waybill can be looked up on the public tracking page. It shows customer-safe milestones returned by the delivery API.'],
  ['How is COD handled?', 'The platform supports cash and M-Pesa delivery workflows, rider reconciliation, merchant ledgers, and settlement approvals. M-Pesa-backed delivery completion requires a confirmed callback.'],
  ['Can I use my own delivery network?', 'The system supports dispatch routes, manifests, rider stops, barcode checks, delivery proof, and delivery exceptions. Your proposal determines the operating model.'],
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section-pad faq-section" id="faq">
      <div className="container faq-container">
        <div className="section-head">
          <span className="eyebrow-badge">GETTING STARTED</span>
          <h2 className="section-title">Questions before you <span className="text-blue">move inventory?</span></h2>
        </div>
        {questions.map(([question, answer], index) => (
          <div className="faq-item" key={question}>
            <button type="button" className="faq-question" onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}>
              {question}<ChevronDown size={20} className={open === index ? 'faq-chevron open' : 'faq-chevron'} />
            </button>
            {open === index && <p className="faq-answer">{answer}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
