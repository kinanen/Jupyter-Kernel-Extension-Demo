import { Widget } from '@lumino/widgets';
import { MainAreaWidget, ISessionContext } from '@jupyterlab/apputils';
import { KernelMessage, Kernel } from '@jupyterlab/services';
import { ISignal, Signal } from '@lumino/signaling';

export class Q8SPanel extends Widget {
  constructor(sessionContext: ISessionContext) {
    super();
    this._sessionContext = sessionContext;
    this.initializePanel();
  }

  private createJobForm(): HTMLFormElement {
    const form = document.createElement('form');
    form.className = 'q8s-job-form';

    const fields = [
      {
        label: 'Job Name',
        type: 'text',
        id: 'jobName',
        value: 'Quantum-Job',
        required: true
      },
      {
        label: 'Hardware Backend',
        type: 'select',
        id: 'hardwareBackend',
        options: [
          { value: 'QPU', text: 'QPU' },
          { value: 'Single GPU', text: 'Single GPU' },
          { value: 'Multi GPU(MPI)', text: 'Multi GPU(MPI)' },
          { value: 'CPU', text: 'CPU' }
        ],
        required: true
      }
    ];

    fields.forEach(field => {
      const div = document.createElement('div');
      div.className = 'form-group';

      const label = document.createElement('label');
      label.htmlFor = field.id;
      label.textContent = field.label;

      if (field.type === 'select') {
        const select = document.createElement('select');
        select.id = field.id;
        select.required = field.required || false;

        field.options?.forEach(option => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.text;
          select.appendChild(opt);
        });

        div.appendChild(label);
        div.appendChild(select);
      } else {
        const input = document.createElement('input');
        input.id = field.id;
        input.type = field.type;
        if ('value' in field) {
          input.value = field.value as string;
        }
        input.required = field.required || false;

        div.appendChild(label);
        div.appendChild(input);
      }

      form.appendChild(div);
    });

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Submit changes';
    form.appendChild(submitButton);

    form.addEventListener('submit', e => {
      e.preventDefault();
      this.handleJobSubmission(form);
    });

    const viewJobButton = document.createElement('button');
    viewJobButton.type = 'button';
    viewJobButton.textContent = 'View jobspec';
    form.appendChild(viewJobButton);

    viewJobButton.addEventListener('click', e => {
      e.preventDefault();
      this.viewJobSpec(form);
    });

    return form;
  }

  private viewJobSpec(form: HTMLFormElement): void {
    const formData = new FormData(form);
    const jobConfig = {
      name: formData.get('jobName'),
      backend: formData.get('hardwareBackend') as string
    };

    const jobSpec = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: jobConfig.name
      },
      spec: {
        template: {
          metadata: {
            name: `${jobConfig.name}-pod`
          },
          spec: {
            containers: [{
              name: 'quantum-task',
              image: 'q8s-registry/quantum-task:latest',
              command: ['python', '/app/main.py'],
              resources: {
                limits: {
                  limits: {
                    [jobConfig.backend === 'QPU' ? 'q8s.com/gpu' : jobConfig.backend === 'Single GPU' ? 'q8s.com/gpu' : jobConfig.backend === 'Multi GPU(MPI)' ? 'q8s.com/gpu' : 'q8s.com/cpu']: 1
                  }
                }
              },
              volumeMounts: [{
                name: 'source-code-volume',
                mountPath: '/app'
              }]
            }],
            volumes: [{
              name: 'source-code-volume',
              configMap: {
                name: 'task-files'
              }
            }],
            restartPolicy: 'Never'
          }
        }
      }
    };

    console.log('Job Specification:', JSON.stringify(jobSpec, null, 2));
    // TODO: Display jobSpec in UI or send to kernel
  }

  //OUTDATED
  private handleJobSubmission(form: HTMLFormElement): void {
    const formData = new FormData(form);
    const jobConfig = {
      name: formData.get('jobName'),
      gpuCount: parseInt(formData.get('gpuCount') as string)
    };

    if (this._comm) {
      this._comm.send({
        code: `submit_job(${JSON.stringify(jobConfig)})`
      });
    } else {
      console.error('No communication channel available');
    }
  }

  private async initializePanel(): Promise<void> {
    console.log('Initializing Q8S Panel, session:', this._sessionContext);
    this.node.textContent = 'Initializing Q8S Panel...';
    const form = this.createJobForm();
    this.node.textContent = '';
    this.node.appendChild(form);

    try {
      await this._sessionContext.ready;
      await this.setupKernelComm();
      await this.executeTest();
    } catch (error) {
      //console.error('Panel initialization failed:', error);
      //this.node.textContent = 'Error: Failed to initialize panel';
    }
  }

  private async setupKernelComm(): Promise<void> {
    console.log('SessionContext:', this._sessionContext);
    this._sessionContext.sessionChanged.connect((_, session) => {
      console.log('Session initialized:', session);
      console.log('Kernel:', this._sessionContext.session?.kernel);
    });

    // entering the following line, the following  prints end up 'undefined'
    const kernel = this._sessionContext.session?.kernel;
    console.log('Session:', this._sessionContext.session?.name);
    console.log('Kernel:', this._sessionContext.session?.kernel);

    if (!kernel) {
      throw new Error('No kernel available');
    }

    try {
      this._comm = kernel.createComm('my_comm_target');

      this._comm.onMsg = (msg: KernelMessage.ICommMsgMsg) => {
        const result = msg.content.data.result;
        this.node.textContent = `Result: ${result}`;
        this._resultChanged.emit(result);
      };

      this._comm.onClose = (msg: KernelMessage.ICommCloseMsg) => {
        console.log('Comm channel closed:', msg);
        this._comm = null;
      };

      this._comm.open();
      this._comm.send({ code: '1+1' });
    } catch (error) {
      console.error('Comm setup failed:', error);
      throw error;
    }
  }

  private async executeTest(): Promise<void> {
    const kernel = this._sessionContext.session?.kernel;
    if (!kernel) {
      throw new Error('No kernel available');
    }

    try {
      const future = kernel.requestExecute({ code: '1+1' });
      future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
        if (msg.header.msg_type === 'execute_result') {
          console.log('Test result:', msg.content);
        }
      };
    } catch (error) {
      console.error('Test execution failed:', error);
      throw error;
    }
  }

  get resultChanged(): ISignal<this, any> {
    return this._resultChanged;
  }

  dispose(): void {
    if (this._comm) {
      this._comm.close();
      this._comm = null;
    }
    super.dispose();
  }

  private _sessionContext: ISessionContext;
  private _comm: Kernel.IComm | null = null;
  private _resultChanged = new Signal<this, any>(this);
}

export function createQ8SPanel(
  session: ISessionContext
): MainAreaWidget<Q8SPanel> {
  const content = new Q8SPanel(session);
  const widget = new MainAreaWidget({ content });

  widget.id = 'q8s-extension';
  widget.title.label = 'Q8S Panel';
  widget.title.closable = true;

  return widget;
}
