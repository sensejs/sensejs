const projectName = 'sensejs';
const organizationName = 'sensejs';
const projectGithubUrl = 'https://github.com/sensejs/sensejs';

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'SenseJS, a Typescript IoC Framework for Node.js',
  url: 'https://sensejs.io',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName,
  projectName,
  trailingSlash: false,
  themeConfig: {
    navbar: {
      title: 'SenseJS',
      // logo: {
      //   alt: 'My Site Logo',
      //   src: 'img/logo.svg',
      // },
      items: [
        {
          type: 'doc',
          docId: 'introduction/introduction',
          position: 'left',
          label: 'Tutorial',
        },
        // {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: projectGithubUrl,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Tutorial',
              to: '/docs/overview/introduction',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/sensejs',
            },
            {
              label: 'Discord',
              href: 'https://discordapp.com/invite/sensejs',
            },
            // {
            //   label: 'Twitter',
            //   href: 'https://twitter.com/docusaurus',
            // },
          ],
        },
        // {
        //   title: 'More',
        //   items: [
        //     {
        //       label: 'Blog',
        //       to: '/blog',
        //     },
        //     {
        //       label: 'GitHub',
        //       href: projectGithubUrl,
        //     },
        //   ],
        // },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} LAN Xingcan and SenseJS contributors.`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl: `${projectGithubUrl}/edit/master/website/`,
        },
        blog: {
          showReadingTime: true,
          editUrl: `${projectGithubUrl}/edit/master/website/blog/`,
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
