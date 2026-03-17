/**
 * A11y Scanner Test Component
 * This file contains various accessibility issues for testing the extension
 */

import React, { useState } from 'react';

export const TestComponent = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="test-container">
      {/* ===== IMG-ALT VIOLATIONS ===== */}
      <section>
        <h2>Image Alt Text Issues</h2>
        
        {/* FAIL: Image without alt attribute */}
        <img src="/logo.png" />
        
        {/* FAIL: Image with empty alt (if it's not decorative) */}
        <img src="/icon.svg" alt="" />
        
        {/* PASS: Image with proper alt text */}
        <img src="/profile.jpg" alt="User profile picture" />
      </section>

      {/* ===== BUTTON-LABEL VIOLATIONS ===== */}
      <section>
        <h2>Button Label Issues</h2>
        
        {/* FAIL: Button with no text or aria-label */}
        <button>
          <span className="icon">🔍</span>
        </button>
        
        {/* FAIL: Button with icon only, no aria-label */}
        <button>
          <svg><path d="M..." /></svg>
        </button>
        
        {/* PASS: Button with aria-label */}
        <button aria-label="Search">
          <span className="icon">🔍</span>
        </button>
        
        {/* PASS: Button with text content */}
        <button>Submit Form</button>
      </section>

      {/* ===== ARIA-ROLE VIOLATIONS ===== */}
      <section>
        <h2>ARIA Role Issues</h2>
        
        {/* FAIL: Invalid ARIA role */}
        <div role="invalid-role">
          This has an invalid role
        </div>
        
        {/* FAIL: Invalid role value */}
        <div role="superbutton">
          Custom button
        </div>
        
        {/* PASS: Valid ARIA role */}
        <div role="alert">
          Important notification
        </div>
        
        {/* PASS: Valid role for interactive element */}
        <div role="button" tabIndex={0}>
          Clickable element
        </div>
      </section>

      {/* ===== FORM-LABEL VIOLATIONS ===== */}
      <section>
        <h2>Form Label Issues</h2>
        
        {/* FAIL: Input without label */}
        <input type="text" placeholder="Enter your name" />
        
        {/* FAIL: Input with placeholder only (no label) */}
        <input type="email" placeholder="your@email.com" />
        
        {/* PASS: Input with associated label */}
        <label htmlFor="username">Username</label>
        <input id="username" type="text" />
        
        {/* PASS: Input with aria-label */}
        <input type="password" aria-label="Password" />
        
        {/* FAIL: Label without associated input */}
        <label>Email Address</label>
        <input type="email" />
        
        {/* PASS: Select with label */}
        <label htmlFor="country">Country</label>
        <select id="country">
          <option>Select a country</option>
          <option>USA</option>
          <option>Canada</option>
        </select>
      </section>

      {/* ===== CLICK-EVENTS-HAVE-KEY-EVENTS VIOLATIONS ===== */}
      <section>
        <h2>Keyboard Event Issues</h2>
        
        {/* FAIL: onClick handler on non-button element without keyboard support */}
        <div onClick={() => console.log('clicked')}>
          Clickable div without keyboard support
        </div>
        
        {/* FAIL: Span with onClick and no keyboard handling */}
        <span onClick={() => setIsOpen(!isOpen)}>
          Toggle menu
        </span>
        
        {/* FAIL: Custom element with onClick but no keyboard */}
        <div 
          className="custom-button"
          onClick={() => alert('Action performed')}
        >
          Custom action
        </div>
        
        {/* PASS: Element with onClick and onKeyDown */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => console.log('clicked')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              console.log('keyboard triggered');
            }
          }}
        >
          Accessible custom button
        </div>
        
        {/* PASS: Regular button element (has keyboard support by default) */}
        <button onClick={() => console.log('clicked')}>
          Native button
        </button>
      </section>

      {/* ===== HEADING-ORDER VIOLATIONS ===== */}
      <section>
        <h2>Heading Order Issues</h2>
        
        {/* FAIL: Skipped heading level (h2 -> h4) */}
        <h2>Main Title</h2>
        <h4>Subsection without h3</h4>
        
        {/* FAIL: Multiple h1 elements */}
        <h1>First Main Heading</h1>
        <h1>Second Main Heading</h1>
        
        {/* PASS: Proper heading hierarchy */}
        <h1>Page Title</h1>
        <h2>Section</h2>
        <h3>Subsection</h3>
        <h4>Detail</h4>
      </section>

      {/* ===== ARIA-PATTERN VIOLATIONS ===== */}
      <section>
        <h2>ARIA Pattern Issues</h2>
        
        {/* FAIL: Expandable element without aria-expanded */}
        <button onClick={() => setIsOpen(!isOpen)}>
          Menu
        </button>
        {isOpen && (
          <ul>
            <li>Option 1</li>
            <li>Option 2</li>
          </ul>
        )}
        
        {/* PASS: Expandable with aria-expanded */}
        <button 
          aria-expanded={isOpen}
          aria-controls="menu-items"
          onClick={() => setIsOpen(!isOpen)}
        >
          Menu
        </button>
        {isOpen && (
          <ul id="menu-items">
            <li>Option 1</li>
            <li>Option 2</li>
          </ul>
        )}
        
        {/* FAIL: Modal without role="dialog" */}
        <div className="modal">
          <p>This is a modal dialog</p>
          <button>Close</button>
        </div>
        
        {/* PASS: Proper modal with role and aria attributes */}
        <div className="modal" role="dialog" aria-labelledby="modal-title">
          <h2 id="modal-title">Dialog Title</h2>
          <p>Modal content</p>
          <button>Close</button>
        </div>
      </section>

      {/* ===== COLOR-CONTRAST VIOLATIONS ===== */}
      <section>
        <h2>Color Contrast Issues</h2>
        
        {/* FAIL: Light text on light background */}
        <div style={{ background: '#f0f0f0', color: '#f5f5f5' }}>
          Poor contrast text
        </div>
        
        {/* FAIL: Light gray text */}
        <p style={{ color: '#cccccc', background: '#ffffff' }}>
          Light gray text on white
        </p>
        
        {/* PASS: Dark text on light background */}
        <div style={{ background: '#ffffff', color: '#000000' }}>
          Good contrast text
        </div>
        
        {/* PASS: Light text on dark background */}
        <div style={{ background: '#333333', color: '#ffffff' }}>
          Good contrast text
        </div>
      </section>

      {/* ===== NESTED ACCESSIBILITY ISSUES ===== */}
      <section>
        <h2>Nested Interactive Elements (Bad Practice)</h2>
        
        {/* FAIL: Button inside button */}
        <button>
          Outer button
          <button>Inner button</button>
        </button>
        
        {/* FAIL: Link inside button */}
        <button>
          Click here <a href="/page">link</a>
        </button>
      </section>

      {/* ===== FORM VALIDATION ===== */}
      <section>
        <h2>Form Validation Issues</h2>
        
        {/* FAIL: Input without required indicator */}
        <label htmlFor="required-field">
          Name (required)
        </label>
        <input id="required-field" type="text" />
        
        {/* PASS: Input with proper attributes */}
        <label htmlFor="proper-field">
          Email (required)
        </label>
        <input 
          id="proper-field" 
          type="email" 
          required 
          aria-required="true"
        />
        
        {/* FAIL: Error message without connection to input */}
        <input type="email" />
        <span>Please enter a valid email</span>
        
        {/* PASS: Error message with aria-describedby */}
        <input type="email" aria-describedby="email-error" />
        <span id="email-error">Please enter a valid email</span>
      </section>

      {/* ===== DATA TABLE ISSUES ===== */}
      <section>
        <h2>Table Accessibility Issues</h2>
        
        {/* FAIL: Table without headers */}
        <table>
          <tr>
            <td>John</td>
            <td>Developer</td>
            <td>5 years</td>
          </tr>
        </table>
        
        {/* PASS: Proper table structure */}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Experience</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John</td>
              <td>Developer</td>
              <td>5 years</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ===== LIST ISSUES ===== */}
      <section>
        <h2>List Issues</h2>
        
        {/* FAIL: Semantically incorrect list structure */}
        <div>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </div>
        
        {/* PASS: Proper list */}
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      </section>

      {/* ===== FOCUS MANAGEMENT ===== */}
      <section>
        <h2>Focus Management</h2>
        
        {/* FAIL: Element with tabIndex="-1" but should be focusable */}
        <button tabIndex={-1}>Unfocusable button</button>
        
        {/* FAIL: No visible focus indicator */}
        <input 
          type="text" 
          style={{
            outline: 'none',
            border: 'none'
          }}
        />
        
        {/* PASS: Proper focusable element */}
        <button tabIndex={0}>Focusable button</button>
      </section>
    </div>
  );
};

export default TestComponent;
