const { strict: assert } = require('assert');
const FixtureBuilder = require('../fixture-builder');
const { mockServerJsonRpc } = require('../mock-server-json-rpc');

const {
  WINDOW_TITLES,
  defaultGanacheOptions,
  openDapp,
  unlockWallet,
  withFixtures,
} = require('../helpers');

const bannerAlertSelector = '[data-testid="security-provider-banner-alert"]';
const selectedAddress = '0x5cfe73b6021e818b776b421b1c4db2474086a7e1';
const mockMaliciousAddress = '0x5fbdb2315678afecb367f032d93f642f64180aa3';

const expectedMaliciousTitle = 'This is a deceptive request';

const testMaliciousConfigs = [
  {
    btnSelector: '#maliciousSeaport',
    expectedDescription:
      'If you approve this request, someone can steal your assets listed on OpenSea.',
    expectedReason: 'seaport_farming',
  },
];

async function mockInfura(mockServer) {
  await mockServerJsonRpc(mockServer, [
    ['eth_blockNumber'],
    ['eth_call'],
    ['eth_estimateGas'],
    ['eth_feeHistory'],
    ['eth_gasPrice'],
    ['eth_getBalance'],
    ['eth_getBlockByNumber'],
    ['eth_getCode'],
    ['eth_getTransactionCount'],
  ]);
}

async function mockInfuraWithMaliciousResponses(mockServer) {
  await mockInfura(mockServer);

  await mockServer
    .forPost()
    .withJsonBodyIncluding({
      method: 'debug_traceCall',
      params: [{ accessList: [], data: '0x00000000' }],
    })
    .thenCallback((req) => {
      return {
        statusCode: 200,
        json: {
          jsonrpc: '2.0',
          id: req.body.json.id,
          result: {
            calls: [
              {
                error: 'execution reverted',
                from: '0x0000000000000000000000000000000000000000',
                gas: '0x1d55c2cb',
                gasUsed: '0x39c',
                input: '0x00000000',
                to: mockMaliciousAddress,
                type: 'DELEGATECALL',
                value: '0x0',
              },
            ],
            error: 'execution reverted',
            from: '0x0000000000000000000000000000000000000000',
            gas: '0x1dcd6500',
            gasUsed: '0x721e',
            input: '0x00000000',
            to: mockMaliciousAddress,
            type: 'CALL',
            value: '0x0',
          },
        },
      };
    });

  return [
    await mockServer
      .forPost('https://api.segment.io/v1/batch')
      .withJsonBodyIncluding({
        batch: [
          {
            type: 'track',
            // event: "Signature Requested",
            // properties: {
            //   action: "Sign Request",
            //   category: "Transactions",
            //   security_alert_reason: "seaport_farming",
            //   security_alert_response: "Malicious",
            //   type: "eth_signTypedData",
            //   ui_customizations: [
            //     "flagged_as_malicious"
            //   ]
            // },
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

describe('Confirmation Security Alert - Blockaid @no-mmi', function () {
  it('should show security alerts for malicious requests', async function () {
    await withFixtures(
      {
        dapp: true,
        fixtures: new FixtureBuilder()
          .withNetworkControllerOnMainnet()
          .withPermissionControllerConnectedToTestDapp()
          .withPreferencesController({
            securityAlertsEnabled: true,
          })
          .withMetaMetricsController({
            metaMetricsId: 'fake-metrics-id',
            participateInMetaMetrics: true,
          })
          .build(),
        defaultGanacheOptions,
        testSpecificMock: mockInfuraWithMaliciousResponses,
        title: this.test.fullTitle(),
      },

      async ({ driver, mockedEndpoint: mockedEndpoints }) => {
        await driver.navigate();
        await unlockWallet(driver);
        await openDapp(driver);

        for (const config of testMaliciousConfigs) {
          const { expectedDescription, expectedReason, btnSelector } = config;

          // Click TestDapp button to send JSON-RPC request
          await driver.clickElement(btnSelector);

          // Wait for confirmation pop-up
          const windowHandles = await driver.waitUntilXWindowHandles(3);
          await driver.switchToWindowWithTitle(
            WINDOW_TITLES.Notification,
            windowHandles,
          );

          // Find element by title
          const bannerAlertFoundByTitle = await driver.findElement({
            css: bannerAlertSelector,
            text: expectedMaliciousTitle,
          });
          const bannerAlertText = await bannerAlertFoundByTitle.getText();

          assert(
            bannerAlertFoundByTitle,
            `Banner alert not found. Expected Title: ${expectedMaliciousTitle} \nExpected reason: ${expectedReason}\n`,
          );
          assert(
            bannerAlertText.includes(expectedDescription),
            `Unexpected banner alert description. Expected: ${expectedDescription} \nExpected reason: ${expectedReason}\n`,
          );

          await driver.clickElement({ text: 'See details', tag: 'p' });

          await driver.clickElement({ text: 'Contact us', tag: 'a' });

          // Wait for confirmation pop-up to close
          await driver.clickElement({ text: 'Reject', tag: 'button' });
          await driver.switchToWindowWithTitle(
            WINDOW_TITLES.TestDApp,
            windowHandles,
          );

          console.log('mockedEndpoints', mockedEndpoints);
          const events = await getEventPayloads(driver, mockedEndpoints);
          console.log('events', events);
        }
      },
    );
  });
});
