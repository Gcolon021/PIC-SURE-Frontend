// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';

import { config } from '$lib/configuration.svelte';
import { genomicFilters } from '$lib/stores/Filter';
import { QueryV2 } from '$lib/models/query/Query';
import {
  getBlankQueryRequestV2,
  getBlankQueryRequestV3,
  updateConsentFilters,
} from '$lib/utilities/QueryBuilder';

const harmonizedConsentPath = '\\_harmonized_consent\\';
const topmedConsentPath = '\\_topmed_consents\\';
const harmonizedCategoryPath = '\\DCC Harmonized data set\\some\\concept\\';

function queryWithConsents(): QueryV2 {
  const query = new QueryV2();
  query.addCategoryFilter(harmonizedConsentPath, ['yes']);
  query.addCategoryFilter(topmedConsentPath, ['yes']);
  return query;
}

afterEach(() => {
  config.features.requireConsents = false;
  genomicFilters.set([]);
});

describe('updateConsentFilters (V2)', () => {
  it('removes both consent filters when there is no harmonized field and no genomic filter', () => {
    const result = updateConsentFilters(queryWithConsents());

    expect(result.categoryFilters).not.toHaveProperty(harmonizedConsentPath);
    expect(result.categoryFilters).not.toHaveProperty(topmedConsentPath);
  });

  it('keeps the harmonized consent filter when a harmonized category filter is present', () => {
    const query = queryWithConsents();
    query.addCategoryFilter(harmonizedCategoryPath, ['value']);

    const result = updateConsentFilters(query);

    expect(result.categoryFilters).toHaveProperty(harmonizedConsentPath);
  });

  it('keeps the topmed consent filter when a genomic filter is present', () => {
    genomicFilters.set([
      {
        id: 'genomic-1',
        filterType: 'genomic',
        Gene_with_variant: ['BRCA1'],
      } as never,
    ]);

    const result = updateConsentFilters(queryWithConsents());

    expect(result.categoryFilters).toHaveProperty(topmedConsentPath);
  });
});

describe('getBlankQueryRequestV2 with REQUIRE_CONSENTS', () => {
  it('leaves consent filters untouched when requireConsents is false', () => {
    config.features.requireConsents = false;

    const { query } = getBlankQueryRequestV2(false, 'resource-uuid', 'COUNT', (q) => {
      q.addCategoryFilter(harmonizedConsentPath, ['yes']);
      q.addCategoryFilter(topmedConsentPath, ['yes']);
      return q;
    });

    expect(query.categoryFilters).toHaveProperty(harmonizedConsentPath);
    expect(query.categoryFilters).toHaveProperty(topmedConsentPath);
  });

  it('strips consent filters that lack backing data when requireConsents is true', () => {
    config.features.requireConsents = true;

    const { query } = getBlankQueryRequestV2(false, 'resource-uuid', 'COUNT', (q) => {
      q.addCategoryFilter(harmonizedConsentPath, ['yes']);
      q.addCategoryFilter(topmedConsentPath, ['yes']);
      return q;
    });

    expect(query.categoryFilters).not.toHaveProperty(harmonizedConsentPath);
    expect(query.categoryFilters).not.toHaveProperty(topmedConsentPath);
  });

  it('skips consent filtering entirely for open-access queries even when requireConsents is true', () => {
    config.features.requireConsents = true;

    const { query } = getBlankQueryRequestV2(true, 'resource-uuid', 'COUNT', (q) => {
      q.addCategoryFilter(harmonizedConsentPath, ['yes']);
      q.addCategoryFilter(topmedConsentPath, ['yes']);
      return q;
    });

    expect(query.categoryFilters).toHaveProperty(harmonizedConsentPath);
    expect(query.categoryFilters).toHaveProperty(topmedConsentPath);
  });
});

describe('getBlankQueryRequestV3 with REQUIRE_CONSENTS', () => {
  it('leaves authorization filters untouched when requireConsents is false', () => {
    config.features.requireConsents = false;

    const { query } = getBlankQueryRequestV3(false, 'resource-uuid', 'COUNT', (q) => {
      q.authorizationFilters = [
        { conceptPath: harmonizedConsentPath, values: ['yes'] },
        { conceptPath: topmedConsentPath, values: ['yes'] },
      ];
      return q;
    });

    const paths = query.authorizationFilters.map((af: { conceptPath: string }) => af.conceptPath);
    expect(paths).toContain(harmonizedConsentPath);
    expect(paths).toContain(topmedConsentPath);
  });

  it('strips authorization filters that lack backing data when requireConsents is true', () => {
    config.features.requireConsents = true;

    const { query } = getBlankQueryRequestV3(false, 'resource-uuid', 'COUNT', (q) => {
      q.authorizationFilters = [
        { conceptPath: harmonizedConsentPath, values: ['yes'] },
        { conceptPath: topmedConsentPath, values: ['yes'] },
      ];
      return q;
    });

    expect(query.authorizationFilters).toEqual([]);
  });

  it('keeps the topmed authorization filter when genomic filters are present', () => {
    config.features.requireConsents = true;

    const { query } = getBlankQueryRequestV3(false, 'resource-uuid', 'COUNT', (q) => {
      q.authorizationFilters = [{ conceptPath: topmedConsentPath, values: ['yes'] }];
      q.genomicFilters = [{ Gene_with_variant: ['BRCA1'] } as never];
      return q;
    });

    const paths = query.authorizationFilters.map((af: { conceptPath: string }) => af.conceptPath);
    expect(paths).toContain(topmedConsentPath);
  });

  it('keeps the harmonized authorization filter when the phenotypic clause references a harmonized concept', () => {
    config.features.requireConsents = true;

    const { query } = getBlankQueryRequestV3(false, 'resource-uuid', 'COUNT', (q) => {
      q.authorizationFilters = [{ conceptPath: harmonizedConsentPath, values: ['yes'] }];
      q.phenotypicClause = {
        type: 'PhenotypicFilter',
        phenotypicFilterType: 'FILTER',
        conceptPath: harmonizedCategoryPath,
        not: false,
      };
      return q;
    });

    const paths = query.authorizationFilters.map((af: { conceptPath: string }) => af.conceptPath);
    expect(paths).toContain(harmonizedConsentPath);
  });
});
