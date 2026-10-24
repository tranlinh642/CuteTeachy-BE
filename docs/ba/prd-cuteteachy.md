Project PRD: CuteTeachy

Product Vision

Serene Educator is a minimalist, cute, and organized time-management and to-do application tailored specifically for female educators. The app aims to reduce the cognitive load of teaching by providing a "calm" digital workspace that balances professional utility with a warm, approachable aesthetic.

Design Philosophy & Visual Vibe

Minimalist & Serene: Clean layouts with ample whitespace ("breathable" design).

Pastel Palette: Soft pinks, baby blues, and muted plums/mauves (Brand Color: #f8c8dc).

Typography: Quicksand (Rounded, friendly, and legible).

Geometry: Heavily rounded corners (rounded-2xl / 16px+) for a "cute" and modern feel.

Elevation: Subtle, soft shadows instead of harsh borders to indicate interactivity.

Core Features

3.1 Task & Schedule Management

Daily Overview (Home): A welcoming dashboard with "Today's Focus," class counts, and pending tasks.

Weekly Dashboard: A high-level view of the week's teaching load and personal to-dos.

Monthly Calendar: A full-grid view for long-term planning, featuring expanded views for specific days.

Quick Task Entry: A primary Floating Action Button (FAB) and "Quick Task" buttons for rapid entry.

3.2 Note Taking

Notes & To-Dos: A dedicated space for organized lists and classroom observations.

New Note Creation: A focused, minimalist full-screen modal for capturing ideas without distraction.

3.3 Interactive Components

Date & Time Pickers: Custom-designed overlays that "hug contents" and maintain the pastel aesthetic.

Tagging System: A modular "Create New Tag" flow to categorize tasks by class, priority, or subject.

Platform Adaptations

Mobile-First: Optimized for one-handed use with clear tap targets and modular overlays.

Desktop Web: A spacious 16:9 dashboard that leverages extra real estate for side-by-side views (e.g., Calendar + Notes) while maintaining the "Serene" aesthetic.

Accessibility Standards (WCAG 2.1 AA)

Following a comprehensive audit, the following requirements are mandatory:

Contrast: Darken text elements to deep plum or charcoal when placed on light pastel backgrounds.

Touch Targets: Maintain minimum 44x44px hit areas for all interactive icons (Edit, Delete, Close).

Semantics: Use 

<button>

, 

<nav>

, and 

<label>

 elements; ensure all functional icons have descriptive aria-label attributes.

Focus States: Clear, high-contrast focus rings for keyboard and assistive technology navigation.

Technical Stack

Frontend: HTML5, CSS3 (Tailwind CSS for utility-first styling).

Interactivity: Vanilla JavaScript for state management (modal toggles, picker selections).

Assets: Clean SVG line-art for brand icons and logos.