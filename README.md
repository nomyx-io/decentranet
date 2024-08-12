# @nomyx/decentranet

A powerful library for building decentralized applications that can run seamlessly across browser, server, and peer environments.

[![npm version](https://badge.fury.io/js/%40nomyx%2Fdecentranet.svg)](https://badge.fury.io/js/%40nomyx%2Fdecentranet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Multi-context Support**: Run your app in browser, server, or peer environments with a unified API.
- **Reactive UI**: Build dynamic user interfaces with a reactive component system.
- **Distributed State Management**: Easily manage and synchronize state across multiple peers.
- **Peer-to-Peer Communication**: Seamless P2P networking with built-in WebRTC support.
- **Plugin System**: Extend your app's functionality with a flexible plugin architecture.
- **Development Tools**: Comprehensive toolset for debugging and monitoring your decentralized apps.
- **TypeScript Support**: Full TypeScript support for enhanced developer experience.

## Installation

```bash
npm install @nomyx/decentranet
```

or

```bash
yarn add @nomyx/decentranet
```

## Quick Start

Here's a simple example to get you started with a decentralized chat application:

```typescript
import { DecentralizedApp, Component, GunDataProvider } from '@nomyx/decentranet';

class ChatComponent extends Component<{ messages: string[] }, {}> {
  constructor(contexts: string[], dataProvider: GunDataProvider) {
    super(contexts, dataProvider, { messages: [] }, {});
  }

  render(): string {
    return `
      <div>
        ${this.state.messages.map(msg => `<p>${msg}</p>`).join('')}
      </div>
      <input id="messageInput" type="text">
      <button onclick="sendMessage()">Send</button>
    `;
  }

  sendMessage(message: string) {
    this.setState({ messages: [...this.state.messages, message] });
  }
}

const app = new DecentralizedApp(new GunDataProvider());

app.initialize().then(() => {
  const chatComponent = new ChatComponent(['browser'], app.gunDataProvider);
  chatComponent.mount(document.getElementById('app')!);
  app.start();
});
```

## Documentation

For more detailed information about using @nomyx/decentranet, please refer to our [comprehensive guide](./HOWTO.md).

## API Reference

Detailed API documentation can be found [here](./API.md).

## Examples

Check out our [examples directory](./examples) for more complex usage scenarios and best practices.

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for more details.

## License

@nomyx/decentranet is [MIT licensed](./LICENSE).

## Support

If you encounter any issues or have questions, please file an issue on our [GitHub issue tracker](https://github.com/nomyx/decentranet/issues).

## Acknowledgements

@nomyx/decentranet is built on top of several amazing open-source projects, including [GunDB](https://gun.eco/), [WebRTC](https://webrtc.org/), and many others. We're grateful for their contributions to the open-source community.

## Stay Connected

- Follow us on [Twitter](https://twitter.com/nomyxdecentranet) for updates
- Join our [Discord community](https://discord.gg/nomyxdecentranet) for discussions and support

Happy decentralized app building!