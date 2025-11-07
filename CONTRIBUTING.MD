# Contributing Guide

Please follow this guide to ensure a smooth and efficient contribution process.

## Pull Request Guide

When submitting a pull request (PR), please adhere to the following guidelines:

### General

- Create a new branch from the `main` branch before starting work.
- **Branch names must include the JIRA work item key** (e.g., `SCRUM-42-feat-user-authentication`).
- Keep PRs focused on a single feature, improvement, or bug fix.
- Follow the project's code style and guidelines.
- Ensure your changes do not introduce breaking changes unless discussed beforehand.
- If your PR is related to an existing issue, mention it in the PR description using `fixes #issue_number`.
- Provide clear and concise descriptions for your changes.
- If applicable, add tests to cover your changes.
- PRs should not contain unnecessary commits. Squash commits where necessary.

## Branching Strategy

This project uses **GitHub Flow (feature-branching medium lived)**, a simple and effective branching strategy designed for continuous deployment.

### Overview

- **Main branch**: The `main` branch is the primary branch and should always be in a deployable state.
- **Feature branches**: All new work is done in medium-lived feature branches created from `main`. Each branch has a sole focus. E.g. a user story, a bug fix ...
- **Pull requests**: Changes are merged back to `main` via pull requests after manual review, DoD and CI/CD checks pass.

### Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b SCRUM-42-feat-user-authentication
   ```

2. **Work on your feature** and commit changes following our [Semantic Commit Messages](#semantic-commit-messages) guidelines.

3. **Keep your branch updated** by regularly rebasing or merging from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout SCRUM-42-feat-user-authentication
   git rebase main  # or git merge main
   ```

4. **Open a pull request** targeting `main` when your feature is ready for review.

5. **After approval**, merge the PR into `main`. The branch can then be deleted.

### Best Practices

- Keep branches focused on a single feature, improvement, or bug fix.
- Rebase frequently to minimize merge conflicts and keep history clean.
- Delete branches after they've been merged to keep the repository tidy.
- Never commit directly to `main` - all changes must go through pull requests, pass CICD checks, DOD and manual approval.

## Semantic Commit Messages

We follow a structured commit message convention to maintain a clean and understandable commit history.

### Format

```
<JIRA-KEY> <type>(<scope>): <subject>
```

- `<JIRA-KEY>` is the JIRA work item key (e.g., `SCRUM-42`, `PROJ-123`) - **REQUIRED**
- `<type>` refers to the nature of the change (e.g., `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`).
- `<scope>` is optional but helps clarify what part of the codebase is affected.
- `<subject>` is a concise summary of the change.

### Examples

```txt
SCRUM-42 feat: add user authentication
PROJ-123 fix: resolve database connection issue
SCRUM-45 chore: update dependencies
SCRUM-42 feat(auth): implement OAuth login flow
PROJ-124 fix(db): resolve connection timeout issue
```

### Pull Request Titles

Pull request titles must also include the JIRA work item key:

```txt
SCRUM-42 feat: Add user authentication system
PROJ-123 fix: Resolve database connection issues
```

### References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Commit Messages Guide](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716)

## Reviewing Pull Requests

Code reviews help maintain code quality and share knowledge among contributors.

### Review Process

- Everyone is encouraged to review PRs.
- When reviewing, consider:
  - Code readability and maintainability
  - Consistency with project conventions
  - Possible performance improvements
  - Potential security issues
  - Correctness and completeness of the implementation
- Leave actionable and constructive feedback.
- If changes are required, request modifications before approving the PR.

### How to Leave Effective Feedback

- Be specific about what needs improvement.
- Suggest alternatives when requesting changes.
- Ask clarifying questions if something is unclear.
- Use conventional comments for structured feedback ([Conventional Comments](https://conventionalcomments.org/)).

## License

This project is licensed under the [MIT License](LICENSE).
