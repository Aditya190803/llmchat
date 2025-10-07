# To-Do List (Prioritized)

1. **Stabilize Deep Research mode API separation** - Ensure each research provider uses its dedicated credentials so concurrent deep-research requests don’t collide or exhaust a shared key.

2. **Harden image generation workflow** - Add retries, better error surfacing, and fallback models in `packages/ai/workflow/tasks/image-generation.ts` so user prompts reliably return images even when Gemini throttles or fails.

3. **Implement document deletion API** - Wire a server-side endpoint so removing uploads in the document manager deletes the backing Appwrite/App storage record instead of only pruning client state.

4. **Add message-level search across threads** - Extend the command palette to index conversation content (not just titles) so users can jump to prior answers quickly.

5. **Support conversation export & sharing** - Provide options to save a thread to Markdown/PDF and generate shareable links with redaction controls.

6. **Introduce automated thread digests** - Generate rolling summaries after long sessions so users can resume with a concise recap and key sources.

7. **Expose customizable keyboard shortcuts** - Offer a shortcut manager or cheat-sheet modal to tailor power-user flows beyond the current Cmd/Ctrl+K launcher.

8. **Surface proactive health indicators** - Display connectivity/model quota warnings in the UI (e.g., near the cost tracker) so users understand rate-limit states before sending prompts.
