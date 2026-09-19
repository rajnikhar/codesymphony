type GuideStepsProps = {
  hasRepo: boolean
  hasSelection: boolean
  hasExplanation: boolean
}

export function GuideSteps({
  hasRepo,
  hasSelection,
  hasExplanation,
}: GuideStepsProps) {
  const steps = [
    {
      id: 1,
      title: 'Open a repo',
      body: 'Paste a public GitHub URL — we compose the story from imports and history.',
      done: hasRepo,
    },
    {
      id: 2,
      title: 'Walk the chapters',
      body: 'Overview gives the brief and tour. Then Spine → Links → History, or Playground.',
      done: hasSelection,
    },
    {
      id: 3,
      title: 'Read the explanation',
      body: 'Each file opens with a plain-English scene of how it fits.',
      done: hasExplanation,
    },
  ]

  return (
    <section className="guide" aria-label="How to use CodeSymphony">
      <div className="guide-intro">
        <h2>Walk the exhibition, don’t decode a graph</h2>
        <p>
          Chapters and explanations lead. Open Playground to learn connections
          on the tree — never required.
        </p>
      </div>
      <ol className="guide-steps">
        {steps.map((step) => (
          <li key={step.id} className={step.done ? 'done' : ''}>
            <span className="step-num">{step.done ? '✓' : step.id}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
