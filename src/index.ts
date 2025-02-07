import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { createQ8SPanel as createQ8SPanel } from './widget';
//import { Kernel } from '@jupyterlab/services';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'q8s-extension',
  description: 'Control panel for qubernetes',
  autoStart: true,
  requires: [ICommandPalette],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette) => {
    console.log('JupyterLab extension q8s-extension is activated!');

    let widget: MainAreaWidget<Widget>;

    // Add command immediately
    const command: string = 'q8s-extension:open';
    app.commands.addCommand(command, {
      label: 'Open Q8S Panel',
      execute: async () => {
        if (!widget || widget.isDisposed) {
          // Get the current kernel
          const session = app.serviceManager.sessions.running().next().value;
          //const kernel = session?.kernel;
          console.log('Current session, from the row 30 in index.ts:', session);
          if (session) {
            widget = createQ8SPanel(session);
          } else {
            console.warn('No kernel available');
            return;
          }
        }

        if (!widget.isAttached) {
          app.shell.add(widget, 'main');
        }
        app.shell.activateById(widget.id);
      }
    });

    // Add to command palette
    palette.addItem({ command, category: 'Extension' });
  }
};

export default plugin;
