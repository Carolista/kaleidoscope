# Kaleidoscope

This project was originally born out of an idea I had one day after learning how to build interactive web pages with vanilla JS. I did it to see if I could do it. That legacy app is still a part of this codebase, but today's version illustrates how far I've come as a developer these past few years.

I've always found it to be a nice little break from the world; a place where mindfulness reigns and stress melts away. [Try it out!](http://codewithcarrie.com/kaleidoscope)

## Font Awesome authentication

Installing dependencies requires a Font Awesome token with access to the project's private packages. Set `FONT_AWESOME_AUTH_TOKEN` in your shell before running `npm ci`; the project [`.npmrc`](.npmrc) configures the registries and reads this environment variable.

For CI, add `FONT_AWESOME_AUTH_TOKEN` under **Settings > Secrets and variables > Actions > Repository secrets**. A secret stored only in the `github-pages` environment is not available to the test job. The workflow checks for a missing token before installing dependencies without printing its value.

GitHub does not provide Actions secrets to pull requests from forks or Dependabot, so those runs cannot install the private packages with this workflow.
