# Design Guidelines: Vibe Coding Platform

## Design Approach

**Selected Approach:** Design System with Developer Tool Aesthetics  
**Primary References:** Linear, GitHub, VS Code, Replit  
**Rationale:** As a utility-focused developer productivity tool, the platform requires clarity, efficiency, and familiarity. Drawing from modern dev tools ensures developers feel immediately comfortable while maintaining a polished, professional appearance.

**Key Design Principles:**
- Code-first clarity with minimal visual noise
- Efficient spatial organization for multi-panel workflows
- Dark mode as default (light mode available)
- Fast visual feedback for AI operations
- Professional, technical aesthetic

---

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary):**
- Background: 220 13% 9% (deep blue-gray, almost black)
- Surface: 220 13% 13% (elevated panels)
- Surface Elevated: 220 13% 18% (active tabs, dropdowns)
- Border: 220 13% 25% (subtle separators)
- Primary Brand: 217 91% 60% (vibrant blue for CTAs, active states)
- Primary Hover: 217 91% 65%
- Success/Code Green: 142 76% 36% (file operations, success states)
- Warning/AI Orange: 25 95% 53% (AI processing indicators)
- Error Red: 0 84% 60% (errors, deletions)
- Text Primary: 0 0% 98%
- Text Secondary: 220 13% 65%
- Text Muted: 220 13% 45%

**Light Mode:**
- Background: 0 0% 100%
- Surface: 220 13% 97%
- Surface Elevated: 0 0% 100%
- Border: 220 13% 90%
- Text Primary: 220 13% 9%
- Text Secondary: 220 13% 40%

### B. Typography

**Font Families:**
- Primary: Inter (UI, labels, body text)
- Monospace: JetBrains Mono (code, file paths, technical content)
- Use Google Fonts CDN

**Type Scale:**
- Display (Project titles): 32px/40px, font-weight: 600
- Heading 1 (Section headers): 24px/32px, font-weight: 600
- Heading 2 (Panel titles): 18px/24px, font-weight: 600
- Body Large: 16px/24px, font-weight: 400
- Body: 14px/20px, font-weight: 400
- Caption (metadata, timestamps): 12px/16px, font-weight: 400
- Code: 14px/20px, JetBrains Mono, font-weight: 400

### C. Layout System

**Spacing Scale:** Use Tailwind units of 2, 3, 4, 6, 8, 12, 16, 24 consistently
- Component padding: p-4, p-6
- Section spacing: space-y-6, space-y-8
- Panel gaps: gap-4
- Tight spacing (within components): space-x-2, space-y-2

**Grid System:**
- Main layout: Sidebar (280px fixed) + Main content (flex-1)
- Tab panels: Full width with max-w-7xl container
- Project grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Chat interface: Single column with max-w-4xl

### D. Component Library

**Navigation:**
- Top bar: Fixed header (h-16) with logo, user menu, theme toggle
- Side panel: Fixed left sidebar (w-280px) with tab navigation
- Tabs: Full-height pills with icon + label, active state with primary color background
- Mobile: Bottom tab bar with icons only

**Authentication:**
- Centered modal (max-w-md) with Firebase Google sign-in button
- Clean card design with subtle shadow and rounded corners (rounded-lg)
- Social login button: Full-width, icon + "Continue with Google", height h-12

**AI Chat Interface:**
- Message bubbles: User (bg-primary, rounded-2xl, ml-auto, max-w-3xl), AI (bg-surface elevated, rounded-2xl, mr-auto, max-w-3xl)
- Input area: Fixed bottom (sticky bottom-0), elevated background, rounded-xl text area
- Tool indicators: Small chips showing active tool (write_file, edit_file) in secondary color
- Typing indicator: Animated dots in AI message color

**Repository Connection:**
- Connection card: Centered (max-w-2xl), prominent GitHub icon
- Repository selector: Dropdown with search, shows repo name + last updated
- Status indicator: Connected (green dot) / Disconnected (gray dot)
- File tree: Collapsible folder structure with indentation (pl-4 per level)

**Code Preview (E2B):**
- Split view: Code editor (60%) + Preview panel (40%) on desktop
- Full-width stacked on mobile
- Run button: Fixed top-right, primary color, with play icon
- Terminal output: Monospace font, dark background (bg-black/90), scrollable
- Loading state: Skeleton loader with subtle pulse animation

**Projects Dashboard:**
- Card grid layout with hover elevation
- Each card: Project name, last modified, repo status, preview thumbnail (if available)
- Quick actions: Open, Delete (icon buttons, appear on hover)
- Empty state: Centered illustration + "Create your first project" CTA

**Common UI Elements:**
- Buttons: rounded-lg, h-10 for default, h-12 for primary CTAs, semibold text
- Input fields: bg-surface elevated, border-border, rounded-lg, h-10, focus ring in primary color
- Dropdowns: bg-surface elevated, rounded-lg, subtle shadow-lg
- Modals: Centered, max-w-2xl, bg-surface, rounded-xl, shadow-2xl
- Toast notifications: Fixed bottom-right, slide-in animation, auto-dismiss

### E. Interactions

**Minimal Animation Strategy:**
- Tab switching: 150ms fade transition
- Button states: No custom animations (use default hover/active states)
- Loading states: Simple spinner or skeleton, no elaborate animations
- Toasts: 200ms slide-in from bottom-right
- Modal: 150ms fade with slight scale (scale-95 to scale-100)

**Hover States:**
- Cards: Subtle elevation increase (shadow-md to shadow-lg)
- Buttons: Brightness increase via default button behavior
- List items: Background color change to surface-elevated

---

## Images

**No hero image required** - This is a utility application, not a marketing site.

**In-app Imagery:**
- Empty state illustrations: Simple, line-art style SVG illustrations (use Undraw or similar) for empty projects, disconnected repo states
- AI avatar: Minimalist geometric icon (gradient circle or abstract shape) in chat interface
- User avatars: Circle (w-8 h-8) from Firebase profile photo

---

## Mobile Responsiveness

**Breakpoints:**
- Mobile: < 768px (single column, bottom tab bar)
- Tablet: 768px - 1024px (side panel collapses to icon-only or hamburger)
- Desktop: > 1024px (full sidebar + main content)

**Mobile Adaptations:**
- Hide sidebar, show bottom navigation (4 tabs: Chat, Repo, Preview, Projects)
- Stack split views vertically
- Full-width cards on project grid
- Collapsible sections for repository file tree
- Floating action button for primary actions (e.g., new project)

---

## Accessibility & Dark Mode

- Default to dark mode with toggle in top bar
- Maintain WCAG AA contrast ratios (4.5:1 for body text)
- All form inputs with clear labels and focus states
- Keyboard navigation support for tab switching
- Screen reader labels for icon-only buttons