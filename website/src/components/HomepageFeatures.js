import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';
import {translate} from '@docusaurus/Translate';

const FeatureList = [
  {
    title: translate({
      id: 'header.features.1st.title',
      message: 'Flexible & Customizable',
      description: 'Feature title flexible and customizable',
    }),
    description: translate({
      id: 'header.features.1st.description',
      message:
        'SenseJS is built upon a modularized dependency injection system, almost everything is made into module so that' +
        ' they can be easily composed or replaced by your application.',
    }),
  },
  {
    title: translate({
      id: 'header.features.2nd.title',
      message: 'Blazing Fast',
      description: 'Feature title blazing fast',
    }),
    description: translate({
      id: 'header.features.2nd.description',
      message:
        'To make the performance dependency injection as fast as possible, it is developed from scratch and highly ' +
        'optimized for the usage of SenseJS.',
    }),
  },
  {
    title: translate({
      id: 'header.features.3rd.title',
      message: 'Graceful startup & shutdown',
      description: 'Feature title graceful start up and shutdown',
    }),
    description: translate({
      id: 'header.features.3rd.description',
      message:
        'SenseJS take care of graceful setup and shutdown, based on the dependency graph of modules in your ' +
        'application.',
    }),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">{Svg && <Svg className={styles.featureSvg} alt={title} />}</div>
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
