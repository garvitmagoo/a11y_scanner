/**
 * Sample JSX with Accessibility Violations
 * Use this file to test the A11y Scanner extension
 */

import React, { useState } from "react";

export default function SampleComponent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <div className="app-container">
      {/* ===== IMG-ALT VIOLATIONS ===== */}
      <section>
        <h1>Image Issues</h1>

        {/* VIOLATION: Missing alt text */}
        <img src="/hero.jpg" />

        {/* VIOLATION: Empty alt text */}
        <img src="/logo.png" alt="" />

        {/* GOOD: Proper alt text */}
        <img src="/avatar.jpg" alt="User profile avatar" />
      </section>

      {/* ===== BUTTON LABEL VIOLATIONS ===== */}
      <section>
        <h2>Button Issues</h2>

        {/* VIOLATION: Button with only icon, no accessible text */}
        <button>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
        </button>

        {/* GOOD: Button with aria-label for icon button */}
        <button aria-label="Settings">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.64l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.22-.07.49.12.64l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.64l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.64l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </button>

        {/* GOOD: Button with text */}
        <button onClick={() => setCount(count + 1)}>Click me</button>
      </section>

      {/* ===== FORM LABEL VIOLATIONS ===== */}
      <section>
        <h2>Form Issues</h2>

        {/* VIOLATION: Input without label */}
        <input type="text" placeholder="Enter your name" />

        {/* VIOLATION: Input with only placeholder (not an accessible label) */}
        <input type="email" placeholder="email@example.com" />

        {/* GOOD: Input with associated label */}
        <label htmlFor="username">Username:</label>
        <input id="username" type="text" />

        {/* GOOD: Input with aria-label */}
        <input type="password" aria-label="Password" />

        {/* GOOD: Input in label */}
        <label>
          Remember me
          <input type="checkbox" />
        </label>
      </section>

      {/* ===== KEYBOARD EVENT VIOLATIONS ===== */}
      <section>
        <h2>Keyboard Support Issues</h2>

        {/* VIOLATION: onClick without keyboard support */}
        <div onClick={() => alert("Clicked!")} style={{ cursor: "pointer" }}>
          Click me (no keyboard support)
        </div>

        {/* VIOLATION: Custom element with click handler */}
        <span
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{ cursor: "pointer" }}
        >
          Toggle Menu
        </span>

        {/* GOOD: Element with both click and keyboard handlers */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => alert("Clicked!")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              alert("Keyboard triggered");
            }
          }}
        >
          Accessible custom button
        </div>

        {/* GOOD: Native button has built-in keyboard support */}
        <button onClick={() => alert("Button clicked")}>Native button</button>
      </section>

      {/* ===== ARIA ROLE VIOLATIONS ===== */}
      <section>
        <h2>ARIA Role Issues</h2>

        {/* VIOLATION: Invalid role */}
        <div role="clickable">This has an invalid role</div>

        {/* VIOLATION: Role on text node */}
        <span role="button">Styled as button</span>

        {/* GOOD: Valid role */}
        <div role="alert">This is an important alert</div>

        {/* GOOD: Valid role with proper semantics */}
        <div role="tablist">
          <button role="tab" aria-selected="true" aria-controls="panel-1">
            Tab 1
          </button>
          <button role="tab" aria-selected="false" aria-controls="panel-2">
            Tab 2
          </button>
        </div>
        <div id="panel-1" role="tabpanel">
          Panel 1 content
        </div>
        <div id="panel-2" role="tabpanel" hidden>
          Panel 2 content
        </div>
      </section>

      {/* ===== HEADING ORDER VIOLATIONS ===== */}
      <section>
        <h2>Heading Order Issues</h2>

        {/* VIOLATION: Skipped heading levels */}
        <h2>Section Title</h2>
        <h4>Subsection (should be h3)</h4>

        {/* VIOLATION: Multiple h1 elements */}
        <h1>First Main Title</h1>
        <h1>Second Main Title</h1>

        {/* GOOD: Proper heading hierarchy */}
        <h1>Main Title</h1>
        <h2>Section</h2>
        <h3>Subsection</h3>
        <h4>Detail</h4>
      </section>

      {/* ===== COLOR CONTRAST VIOLATIONS ===== */}
      <section>
        <h2>Color Contrast Issues</h2>

        {/* VIOLATION: Poor contrast */}
        <div style={{ color: "#cccccc", backgroundColor: "#ffffff" }}>
          Light gray text on white (poor contrast)
        </div>

        {/* VIOLATION: Very low contrast */}
        <p style={{ color: "#e0e0e0", backgroundColor: "#f0f0f0" }}>
          Very light text (fails WCAG AA)
        </p>

        {/* GOOD: High contrast */}
        <div style={{ color: "#000000", backgroundColor: "#ffffff" }}>
          Dark text on light background (good contrast)
        </div>

        {/* GOOD: Light text on dark background */}
        <div style={{ color: "#ffffff", backgroundColor: "#333333" }}>
          Light text on dark background (good contrast)
        </div>
      </section>

      {/* ===== ARIA PATTERN VIOLATIONS ===== */}
      <section>
        <h2>ARIA Pattern Issues</h2>

        {/* VIOLATION: Expandable without aria-expanded */}
        <button onClick={() => setIsMenuOpen(!isMenuOpen)}>Menu</button>
        {isMenuOpen && (
          <ul>
            <li>Option 1</li>
            <li>Option 2</li>
            <li>Option 3</li>
          </ul>
        )}

        {/* GOOD: Expandable with proper ARIA attributes */}
        <button
          aria-expanded={isMenuOpen}
          aria-controls="menu-list"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          Menu
        </button>
        {isMenuOpen && (
          <ul id="menu-list">
            <li>Option 1</li>
            <li>Option 2</li>
            <li>Option 3</li>
          </ul>
        )}

        {/* VIOLATION: Modal without dialog role */}
        <div className="modal">
          <p>This looks like a dialog but has no role</p>
          <button>Close</button>
        </div>

        {/* GOOD: Proper dialog pattern */}
        <div className="modal" role="dialog" aria-labelledby="dialog-title">
          <h3 id="dialog-title">Confirm Action</h3>
          <p>Are you sure?</p>
          <button>Yes</button>
          <button>No</button>
        </div>
      </section>

      {/* ===== LINK ISSUES ===== */}
      <section>
        <h2>Link Issues</h2>

        {/* VIOLATION: Link styled like button with role="button" */}
        <a href="/" role="button">
          Link styled as button
        </a>

        {/* GOOD: Proper link */}
        <a href="/page">Go to page</a>

        {/* GOOD: Real button when semantics require it */}
        <button onClick={() => alert("Action")}>Perform action</button>
      </section>

      {/* ===== LIST STRUCTURE ===== */}
      <section>
        <h2>List Structure Issues</h2>

        {/* VIOLATION: Not using semantic list */}
        <div>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </div>

        {/* GOOD: Proper list structure */}
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      </section>

      {/* ===== FOCUS MANAGEMENT ===== */}
      <section>
        <h2>Focus Management</h2>

        {/* VIOLATION: Removed focus indicator */}
        <button style={{ outline: "none" }}>
          Button without focus indicator
        </button>

        {/* GOOD: Button with default focus indicator */}
        <button>Button with focus indicator</button>
      </section>

      {/* ===== MIXED VIOLATIONS ===== */}
      <section>
        <h2>Mixed Violations</h2>

        {/* Multiple violations in one form */}
        <form>
          {/* No label for input */}
          <input type="text" placeholder="Name" />

          {/* No label for select */}
          <select>
            <option>Choose an option</option>
            <option>Option 1</option>
            <option>Option 2</option>
          </select>

          {/* Button with no text */}
          <button>
            <svg width="20" height="20">
              <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
          </button>
        </form>

        {/* GOOD: Accessible form */}
        <form>
          <label htmlFor="fullname">Full Name:</label>
          <input id="fullname" type="text" />

          <label htmlFor="category">Category:</label>
          <select id="category">
            <option>Choose a category</option>
            <option>Category 1</option>
            <option>Category 2</option>
          </select>

          <button type="submit" aria-label="Submit form">
            Submit
          </button>
        </form>
      </section>
    </div>
  );
}
