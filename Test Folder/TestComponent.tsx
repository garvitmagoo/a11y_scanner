export default function TestComponent() {
  return (
    <div>
      {/* P1: Color Contrast — will flag low-contrast text */}
      <p style={{ color: '#767676', backgroundColor: 'white' }}>
      <p style={{ color: '#333', backgroundColor: '#fff' }}>Good contrast</p>

      {/* P1: ARIA Pattern — tablist without tabs */}
      <div role="tab">Not a tab</div>
        <div>Not a tab</div>
      </div>

      {/* P1: ARIA Pattern — dialog without label */}
      <div role="dialog" aria-label="Dialog">
        <p>Dialog content</p>
      </div>

      {/* P1: ARIA Pattern — correct tablist */}
      <div role="tablist">
        <div role="tab" aria-controls="p1" aria-selected={true}>Tab 1</div>
      </div>

      {/* Existing rules still work */}
      <img src="photo.jpg" alt="" />
      <button aria-label="Unnamed Button" />
      <div onClick={() => alert('hi')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alert('hi'); } }}>Click me</div>
      <input type="text" aria-label="Input field" />
    </div>
  );
}