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