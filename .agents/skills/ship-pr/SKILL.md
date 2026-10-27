---
name: ship-pr
description: Commit changes, push a branch, and open a pull request with GitHub issue references and an optional demo when the user asks to ship work or create a PR.
---

# Ship PR

Commit the changes related to the request, push a feature branch, and open a pull request.
Use the repository's default branch unless the user requests another base branch.

## Workflow

1. Inspect the branch, working tree, staged changes, and unstaged changes. Read the relevant untracked files. Preserve unrelated work.
2. Identify related GitHub issues from the request, branch, or commit history. If the association is unclear, ask the user. Never invent issue numbers.
3. If the current branch is the base branch or a protected branch, create a feature branch. Include the issue number in the branch name when available.
4. Stage the changes related to the request. Use the repository's commit conventions and commit the changes. Omit generated-by and co-author footers unless the user requests them.
5. Ask the user for an optional screenshot or recording for the Demo section. If the user declines, omit that section.
6. Push the branch with an upstream. Use `gh` for GitHub operations. Open the PR as ready for review unless the user requests a draft.
7. Use the commit subject as the PR title. Write the body in the format below. Preserve additional required fields from the repository's PR template.
8. Report the PR URL and any relevant limitations. Do not merge the PR unless the user requests it.

## PR body

Keep the body under 150 words where practical. Explain the problem and the decision without repeating the diff.
Use one to three sentences for each of Problem and Solution.

```markdown
## Problem
Describe the user-visible problem and its known cause.

## Solution
Describe the change and any material trade-off.

## GitHub Issues
Closes #123

## Demo
![Screenshot](https://github.com/user-attachments/assets/example)
```

- Replace the example issue and demo with actual references.
- Use `Closes #123` only when the PR fully resolves the issue. Otherwise, use `Related to #123`.
- For multiple issues, put each reference on a separate line.
- If no issue applies, write `N/A` in GitHub Issues.
- For screenshots, use image Markdown. For recordings, use a Markdown link.
- If the user provides a local file, use an available attachment method to obtain a URL accessible to reviewers.
- If upload is unavailable, ask for a hosted URL or a manual attachment. Never use a local path as a demo link.
- Do not add a Happy Path section.
- Omit generated-by footers.

Write the body to a temporary file and pass it with `--body-file` for PR creation or updates.
