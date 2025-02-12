import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { createQ8SPanel as createQ8SPanel } from './widget';
import { ITranslator } from '@jupyterlab/translation';
//import { Kernel } from '@jupyterlab/services';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'q8s-extension',
  description: 'Control panel for qubernetes',
  autoStart: true,
  requires: [ICommandPalette, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    translator: ITranslator
  ) => {
    console.log('JupyterLab extension q8s-extension is activated!');

    let widget: MainAreaWidget<Widget>;

    // Add command immediately
    const command: string = 'q8s-extension:open';
    app.commands.addCommand(command, {
      label: 'Open Q8S Panel',
      execute: async () => {
        if (!widget || widget.isDisposed) {
          const manager = app.serviceManager;
          // const trans = translator.load('jupyterlab');

          widget = createQ8SPanel(manager, translator);
        } else {
          console.warn('No kernel available');
          return;
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
