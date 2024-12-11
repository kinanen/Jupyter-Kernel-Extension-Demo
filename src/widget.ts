import { Widget } from '@lumino/widgets';
import { MainAreaWidget } from '@jupyterlab/apputils';
import { KernelMessage, Kernel } from '@jupyterlab/services';

export const qubetnetesControlPanel = (kernel: Kernel.IKernelConnection) => {
  console.log('Kernel, from the row 6 in widget.ts:', kernel);
  const content = new Widget();
  content.node.textContent = 'Initializing Q8S Panel...';

  const widget = new MainAreaWidget({ content });
  widget.id = 'q8s-extension';
  widget.title.label = 'Q8S Panel';
  widget.title.closable = true;

  setupKernelComm(kernel, content).catch(err => {
    console.error('Failed to setup kernel communication:', err);
    content.node.textContent = 'Error: Failed to connect to kernel';
  });

  return widget;
};

async function setupKernelComm(
  kernel: Kernel.IKernelConnection,
  content: Widget
) {
  try {
    console.log('Kernel Comm setup, from the row 29 in widget.ts:', kernel);
    // Create new comm
    const comm = kernel.createComm('echo');
    console.log('Comm created:', comm);
    // Register message handler
    comm.onMsg = (msg: KernelMessage.ICommMsgMsg) => {
      const result = msg.content.data.result;
      console.log('Received result from kernel:', result);
      content.node.textContent = `Result of 1+1: ${result}`;
    };

    // Open the comm channel
    comm.open();

    // Send calculation request
    comm.send({ code: '1+1' });
  } catch (error) {
    console.error('Comm setup failed:', error);
    throw error;
  }
}
