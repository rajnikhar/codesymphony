import { useState } from 'react'

const STORAGE_KEY = 'codesymphony.layerExplainerDismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function LayerExplainer() {
  const [visible, setVisible] = useState(() => !readDismissed())

  if (!visible) {
    return null
  }

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  return (
    <div className="layer-explainer" role="status">
      <p>
        Files are arranged by how deep they sit in your import chain —
        foundational code sits at the bottom, entry points at the top.
      </p>
      <button type="button" className="ghost" onClick={dismiss}>
        Got it
      </button>
    </div>
  )
}
