# Deployment

For a local static build, run `npm ci` and `npm run build`. Serve `dist/` over HTTP. The default base is relative and hash routes survive refresh.

The GitHub Pages demo workflow uses the Pages action to resolve the repository base path, builds the tested commit, and deploys the uploaded `dist/` artifact. A push to `main` deploys after CI succeeds. Manual deployment runs quality checks before publishing. Select GitHub Actions under Settings → Pages after connecting the authorised repository.

If the CLI reports an expired GitHub session, run `gh auth login -h github.com` then `gh auth status`. Confirm the repository name and visibility before initial publication. After publishing, verify the workflow URL, assets and refresh of a nested hash route.

For a connected commercial build, use commercial hosting and prepare a separately authorised backend environment. See [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite static deployment](https://vite.dev/guide/static-deploy).
