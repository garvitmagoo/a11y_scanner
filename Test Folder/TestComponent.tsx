/**
 * A11y Scanner Test Component
 * This file contains various accessibility issues for testing the extension
 */

import React, { useState } from "react";

export const TestComponent = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      {/* FAIL: Image missing alt text */}
      <img src="logo.png" alt="Company logo" />

      {/* FAIL: Button without accessible text */}
      <button onClick={() => alert("Clicked")} aria-label="Click me"></button>
        <span></span>
      </button>

      {/* FAIL: Button with click handler but no keyboard support */}
      <div
        onClick={() => console.log("div clicked")}
        style={{ cursor: "pointer" }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { console.log("div clicked"); } }}
      >
        onClick={() => console.log("div clicked")}
        style={{ cursor: "pointer" }}
      >
        Click me
      </div>

      {/* FAIL: Form input without label */}
      <label htmlFor="nameInput">Name: <label htmlFor="nameInput">Name: <label htmlFor="nameInput">Name: <input id="nameInput" type="text" placeholder="Enter your name" /></label>

      {/* FAIL: Invalid heading order - h1 followed by h3 */}
      <h1>Main Heading</h1>
      <h2>Subheading (should be h2)</h2>

      {/* FAIL: Aria role conflict - button role on a link */}
      <a href="/" role="button">
        Link styled as button
      </a>

      {/* FAIL: Aria role on text node - invalid */}
      <span role="button">Not a button</span>

      {/* FAIL: Invalid aria pattern - bad attribute */}
      <div aria-label="">Empty label</div>

      {/* FAIL: Color contrast too low */}
      <div style={{ color: '#767676', backgroundColor: '#ffffff' }}>
        Low contrast text
      </div>

      {/* FAIL: Multiple issues - img without alt + form without label */}
      <form>
        <img src="user-icon.png" alt="User icon" />
        <input type="email" aria-label="Email" />
        <button type="submit">Submit</button>
      </form>

      {/* PASS: Proper alt text */}
      <img src="photo.jpg" alt="User profile photo" />

      {/* PASS: Button with text content */}
      <button onClick={() => alert("Hello")}>Submit</button>

      {/* PASS: Input with associated label */}
      <label htmlFor="username">Username</label>
      <input id="username" type="text" />

      {/* PASS: Proper heading order */}
      <h2>Section Two</h2>
      <h3>Subsection</h3>

      {/* PASS: Proper aria role usage */}
      <div role="tablist">
        <button role="tab" aria-selected={true}>
          Tab 1
        </button>
        <button role="tab" aria-selected={false}>
          Tab 2
        </button>
      </div>

      {/* PASS: Good color contrast */}
      <div style={{ color: "#000000", backgroundColor: "#ffffff" }}>
        High contrast text
      </div>

      {/* FAIL: Click handler requires keyboard equivalent */}
      <li role="button" tabIndex={0} onClick={() => setIsOpen(!isOpen)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}>
        Clickable list item (no keyboard support)
      </li>

      {/* PASS: Proper keyboard support with keydown */}
      <li
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setIsOpen(!isOpen);
          }
        }}
        role="button"
        tabIndex={0}
      >
        Accessible clickable list item
      </li>
    </div>
  );
};
