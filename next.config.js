const registryPublicUrl =
  process.env.NEXT_PUBLIC_REGISTRY_PUBLIC_URL || `https://github.com`;
const landingPagePublicUrl = `https://github.com`;

/** @type import('next').NextConfig */
module.exports = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    /**
     * This is checked on CI anyway, so we'll never
     * deploy anything that has type errors
     */
    ignoreBuildErrors: true,
  },
  // basePath: `/xstate-viz`,
  exportPathMap: async function () {
    console.log(arguments);
    return {
      '/': { page: '/[[...sourceFileId]]' },
    };
  },
  /**
   * These rewrites are never used in production - only in development
   */
  // async rewrites() {
  //   return [
  //     {
  //       source: `/registry/:match*`,
  //       basePath: false,
  //       destination: `${registryPublicUrl}/:match*`,
  //     },
  //     {
  //       source: `/`,
  //       destination: `${landingPagePublicUrl}`,
  //       basePath: false,
  //     },
  //   ];
  // },
};
