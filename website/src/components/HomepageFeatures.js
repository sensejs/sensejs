import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: 'Flexible & Customizable',
    description: (
      <>
        SenseJS is built upon a modularized IoC system, almost everything is made into module so that they can be
        easily composed or replaced by your application.
      </>
    )
  },
  {
    title: 'Graceful startup & shutdown',
    // Svg: require('../../static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        SenseJS take care of graceful setup and shutdown, based on the dependency graph of modules in your application.
      </>
    ),
  },
  {
    title: 'Out of box integrations',
    // Svg: require('../../static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        SenseJS currently provides integrations of <a href="https://koajs.com">koa</a>,
        <a href="https://kafka.js.org">kafkajs</a> and <a href="https://typeorm.io">TypeORM</a> out of box.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {Svg && <Svg className={styles.featureSvg} alt={title} />}
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
