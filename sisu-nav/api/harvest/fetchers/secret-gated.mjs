/**
 * MapTiler Satellite / Maxar / Planet: the secret-refusal gate (jobs.mjs's
 * createJob(), checked via providers.mjs's isSecretConfigured()) is real and
 * tested — that is the actual acceptance requirement for these three. Their
 * vendor-specific official export/download integration is not wired up yet;
 * this stays an honest "not implemented" rather than faking a fetch.
 */
export async function runSecretGated({ job, provider }) {
  return {
    unimplemented: true,
    message:
      `${provider.secretEnv} is set, but no official-export fetcher is wired up yet for ` +
      `${job.providerId}. This provider only exists in the dropdown/registry today — file a ` +
      'follow-up issue against the vendor\'s actual offline/export API before relying on it.',
  };
}
