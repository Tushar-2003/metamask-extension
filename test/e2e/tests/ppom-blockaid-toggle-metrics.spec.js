const { strict: assert } = require('assert');
const FixtureBuilder = require('../fixture-builder');
const { mockServerJsonRpc } = require('../mock-server-json-rpc');

const {
  defaultGanacheOptions,
  unlockWallet,
  withFixtures,
  getEventPayloads,
} = require('../helpers');

const selectedAddress = '0x5cfe73b6021e818b776b421b1c4db2474086a7e1';
const selectedAddressWithoutPrefix = '5cfe73b6021e818b776b421b1c4db2474086a7e1';

const CONTRACT_ADDRESS = {
  BalanceChecker: '0xb1f8e55c7f64d203c1400b9d8555d050f94adf39',
  FiatTokenV2_1: '0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf',
  OffChainOracle: '0x52cbe0f49ccdd4dc6e9c13bab024eabd2842045b',
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
};

/**
 * mocks the segment api multiple times for specific payloads that we expect to
 * see when these tests are run. In this case we are looking for
 * 'Transaction Submitted' and 'Transaction Finalized'. In addition on the
 * first event of each series we require a field that should only appear in the
 * anonymized events so that we can guarantee order of seenRequests and can
 * properly make assertions. Do not use the constants from the metrics
 * constants files, because if these change we want a strong indicator to our
 * data team that the shape of data will change.
 *
 * @param {import('mockttp').Mockttp} mockServer
 * @returns {Promise<import('mockttp/dist/pluggable-admin').MockttpClientResponse>[]}
 */

async function mockServerCalls(mockServer) {
  return [
    await mockServer
      .forPost('https://api.segment.io/v1/batch')
      .withJsonBodyIncluding({
        batch: [
          {
            type: 'track',
            event: 'Settings Updated',
            properties: {
              blockaid_alerts_enabled: true,
              category: 'Settings',
            },
          },
        ],
      })
      .thenCallback(() => {
        return {
          statusCode: 200,
        };
      }),
    await mockServer
      .forPost('https://api.segment.io/v1/batch')
      .withJsonBodyIncluding({
        batch: [
          {
            type: 'track',
            event: 'Settings Updated',
            properties: {
              blockaid_alerts_enabled: false,
              category: 'Settings',
            },
          },
        ],
      })
      .thenCallback(() => {
        return {
          statusCode: 200,
        };
      }),
  ];
}

describe('PPOM Blockaid Alert - Metrics', function () {
  it('Successfully track button toggle on/off', async function () {
    await withFixtures(
      {
        dapp: true,
        fixtures: new FixtureBuilder()
          .withNetworkControllerOnMainnet()
          .withPermissionControllerConnectedToTestDapp()
          .withMetaMetricsController({
            metaMetricsId: 'fake-metrics-id',
            participateInMetaMetrics: true,
          })
          .build(),
        ganacheOptions: defaultGanacheOptions,
        title: this.test.fullTitle(),
        testSpecificMock: mockServerCalls,
      },
      async ({ driver, mockedEndpoint: mockedEndpoints }) => {
        await driver.navigate();
        await unlockWallet(driver);

        // toggle on
        await driver.clickElement(
          '[data-testid="account-options-menu-button"]',
        );
        await driver.clickElement({ text: 'Settings', tag: 'div' });
        await driver.clickElement({ text: 'Experimental', tag: 'div' });
        await driver.clickElement(
          '[data-testid="settings-toggle-security-alert-blockaid"] .toggle-button > div',
        );

        await driver.delay(1000);

        // toggle off
        await driver.clickElement(
          '[data-testid="account-options-menu-button"]',
        );
        await driver.clickElement({ text: 'Settings', tag: 'div' });
        await driver.clickElement({ text: 'Experimental', tag: 'div' });
        await driver.clickElement(
          '[data-testid="settings-toggle-security-alert-blockaid"] .toggle-button > div',
        );

        const events = await getEventPayloads(driver, mockedEndpoints);

        const toggleOnEvent = {
          event: 'Settings Updated',
          properties: {
            blockaid_alerts_enabled: true,
            category: 'Settings',
          },
          userId: 'fake-metrics-id',
          type: 'track',
        };
        const matchToggleOnEvent = {
          event: events[0].event,
          properties: {
            blockaid_alerts_enabled: events[0].properties.blockaid_alerts_enabled,
            category: events[0].properties.category,
          },
          userId: events[0].userId,
          type: events[0].type,
        };

        const toggleOffEvent = {
          event: 'Settings Updated',
          properties: {
            blockaid_alerts_enabled: false,
            category: 'Settings',
          },
          userId: 'fake-metrics-id',
          type: 'track',
        };
        const matchToggleOffEvent = {
          event: events[1].event,
          properties: {
            blockaid_alerts_enabled: events[1].properties.blockaid_alerts_enabled,
            category: events[1].properties.category,
          },
          userId: events[1].userId,
          type: events[1].type,
        };

        assert.equal(events.length, 2);
        assert.deepEqual(toggleOnEvent, matchToggleOnEvent);
        assert.deepEqual(toggleOffEvent, matchToggleOffEvent);
      },
    );
  });
});
