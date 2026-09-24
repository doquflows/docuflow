# Post-MVP Enhancements

The initial MVP of DocuFlow is feature-complete across 6 core milestones. It successfully establishes the "Code = Truth" mechanism via Drift Detection, Q&A, and versioned Document Regeneration.

For future cycles, we plan to evaluate the following enhancements:

1. **Automated CI/CD Integration:** Implement a GitHub Action that runs `docuflow detect-drift` on every Pull Request. It will automatically leave PR comments if the code introduces undocumented changes or if the PR renders existing documentation stale.
2. **Bulk Repository Synthesis:** Add optimizations and chunking strategies to allow DocuFlow to ingest, map, and summarize an entire massive monorepo autonomously overnight.
3. **Multi-Model Support Configuration:** Allow users to seamlessly configure and select between local Ollama endpoints and cloud models dynamically via the `schema.md`.
4. **Interactive Dashboard:** Develop a local Vite-based dashboard visualizing the drift health of the entire project, highlighting which modules are well-documented and which are severely drifting.
