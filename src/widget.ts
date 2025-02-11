import { Widget } from '@lumino/widgets';
import {
  MainAreaWidget,
  ISessionContext,
  showDialog
} from '@jupyterlab/apputils';
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
        name: 'jobName',
        value: 'Quantum-Job',
        required: true
      },
      {
        label: 'Hardware Backend',
        type: 'select',
        id: 'hardwareBackend',
        name: 'hardwareBackend',
        options: [
          { value: 'q8s.com/qpu', text: 'QPU' },
          { value: 'q8s.com/gpu', text: 'Single GPU' },
          { value: 'q8s.com/gpu-mpi', text: 'Multi GPU (MPI)' },
          { value: 'q8s.com/cpu', text: 'CPU' }
        ],
        //needs to be edited to show current backend as default.
        value: 'q8s.com/gpu',
        required: true
      }
    ];

    const gpuMpiField = {
      label: 'Number of MPI Processes',
      type: 'number',
      id: 'gpuMpiCount',
      name: 'gpuMpiCount',
      value: '2', // default
      required: false
    };

    fields.forEach(field => {
      const div = document.createElement('div');
      div.className = 'form-group';

      const label = document.createElement('label');
      label.htmlFor = field.id;
      label.textContent = field.label;

      if (field.type === 'select') {
        const select = document.createElement('select');
        select.id = field.id;
        select.name = field.name;
        select.required = field.required || false;

        field.options?.forEach(option => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.text;
          select.appendChild(opt);
        });

        div.appendChild(label);
        div.appendChild(select);
        form.appendChild(div);
      } else {
        const input = document.createElement('input');
        input.id = field.id;
        input.type = field.type;
        input.name = field.name;
        if ('value' in field) {
          input.value = field.value as string;
        }
        input.required = field.required || false;

        div.appendChild(label);
        div.appendChild(input);
        form.appendChild(div);
      }
    });

    // Create a hidden div for the GPU MPI field
    const mpiDiv = document.createElement('div');
    mpiDiv.className = 'form-group';
    mpiDiv.style.display = 'none'; // initially hidden

    const mpiLabel = document.createElement('label');
    mpiLabel.htmlFor = gpuMpiField.id;
    mpiLabel.textContent = gpuMpiField.label;

    const mpiInput = document.createElement('input');
    mpiInput.id = gpuMpiField.id;
    mpiInput.type = gpuMpiField.type;
    mpiInput.name = gpuMpiField.name;
    mpiInput.value = gpuMpiField.value;
    mpiInput.required = gpuMpiField.required || false;

    mpiDiv.appendChild(mpiLabel);
    mpiDiv.appendChild(mpiInput);
    form.appendChild(mpiDiv);

    // Listen for changes to hardwareBackend
    const hardwareSelect = form.querySelector(
      '#hardwareBackend'
    ) as HTMLSelectElement;

    const qpuLink = document.createElement('a');
    qpuLink.href = '#';
    qpuLink.textContent = 'View QPU Info';
    qpuLink.style.marginLeft = '1rem';

    qpuLink.addEventListener('click', e => {
      e.preventDefault();
      showDialog({
        title: 'QPU Information',
        body: new Widget({
          node: (() => {
            const div = document.createElement('div');
            const img = document.createElement('img');
            img.src =
              'https://cdn.prod.website-files.com/6523f13a748909d3e1bbb657/672b3f81dacde04b62361579_IQM-Crystal20-topology.png';
            img.alt = 'QPU Information';
            img.style.maxWidth = '100%';
            div.appendChild(img);
            return div;
          })()
        }),
        buttons: [
          {
            label: 'Close',
            accept: true,
            caption: 'Close the dialog',
            className: 'my-button',
            displayType: 'default',
            ariaLabel: 'Close button',
            iconClass: '',
            iconLabel: '',
            actions: []
          }
        ]
      });
    });
    qpuLink.style.display = 'none'; // initially hidden
    hardwareSelect.parentElement?.appendChild(qpuLink);

    hardwareSelect.addEventListener('change', () => {
      // Show the MPI field only if "gpu-mpi" is selected
      if (hardwareSelect.value === 'q8s.com/gpu-mpi') {
        mpiDiv.style.display = 'block';
        qpuLink.style.display = 'none';
      } else if (hardwareSelect.value === 'q8s.com/qpu') {
        mpiDiv.style.display = 'none';
        qpuLink.style.display = 'inline';
      } else {
        mpiDiv.style.display = 'none';
        qpuLink.style.display = 'none';
      }
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
      name: formData.get('jobName') as string,
      backend:
        formData.get('hardwareBackend') === 'q8s.com/gpu-mpi'
          ? {
              'q8s.com/gpu-mpi':
                parseInt(formData.get('gpuMpiCount') as string) || 2
            }
          : {
              [formData.get('hardwareBackend') as string]: 1
            }
    };

    console.log('Job config:', jobConfig);

    // Original spec
    const jobSpec = this.getJobSpec();
    // A copy we'll modify
    const newJobSpec = JSON.parse(JSON.stringify(jobSpec));

    // Update the newJobSpec with user inputs
    newJobSpec.metadata.name = jobConfig.name;
    newJobSpec.spec.template.spec.containers[0].resources.limits =
      jobConfig.backend;

    console.log('New job spec:', newJobSpec);

    // Build a diff element showing changes line by line
    const diffElement = this.createJsonDiffView(jobSpec, newJobSpec);

    showDialog({
      title: 'Q8s job spec (diff)',
      body: new Widget({ node: diffElement }),
      host: document.body,
      buttons: [
        {
          label: 'cancel',
          caption: 'cancel changes to jobspec file for kernel',
          className: 'my-button',
          accept: true,
          displayType: 'default',
          ariaLabel: '',
          iconClass: '',
          iconLabel: '',
          actions: []
        },
        {
          label: 'submit changes',
          caption: 'submit changes to jobspec file for kernel',
          className: 'my-button',
          accept: true,
          displayType: 'default',
          ariaLabel: '',
          iconClass: '',
          iconLabel: '',
          actions: []
        }
      ],
      defaultButton: 1,
      hasClose: false
    });
  }

  private createJsonDiffView(oldObj: any, newObj: any): HTMLElement {
    const oldJson = JSON.stringify(oldObj, null, 2);
    const newJson = JSON.stringify(newObj, null, 2);
    const oldLines = oldJson.split('\n');
    const newLines = newJson.split('\n');

    console.log('Old JSON:', oldJson);
    console.log('New JSON:', newJson);

    const container = document.createElement('div');
    container.className = 'diff-container'; // You can style this in CSS

    const maxLength = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i] ?? '';
      const newLine = newLines[i] ?? '';

      if (oldLine === newLine) {
        const lineDiv = document.createElement('div');
        lineDiv.style.whiteSpace = 'pre';
        lineDiv.textContent = oldLine;
        container.appendChild(lineDiv);
      } else {
        const diffDiv = document.createElement('div');
        diffDiv.innerHTML =
          `<span style="color:red; font-weight:bold; white-space:pre;">- ${oldLine}</span>\n` +
          `<span style="color:green; white-space:pre;">+ ${newLine}</span>`;
        container.appendChild(diffDiv);
      }
    }

    return container;
  }

  //PLACE HOLDER, Needs to be implemented with a connection to the kernel, or by using a jobspec file
  private getJobSpec(): any {
    return {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: 'quantum-job'
      },
      spec: {
        template: {
          metadata: {
            name: 'quantum-job-pod'
          },
          spec: {
            containers: [
              {
                name: 'quantum-task',
                image: 'q8s-registry/quantum-task:latest',
                command: ['python', '/app/main.py'],
                resources: {
                  limits: {
                    'q8s.com/gpu': 1
                  }
                },
                volumeMounts: [
                  {
                    name: 'source-code-volume',
                    mountPath: '/app'
                  }
                ]
              }
            ],
            volumes: [
              {
                name: 'source-code-volume',
                configMap: {
                  name: 'task-files'
                }
              }
            ],
            restartPolicy: 'Never'
          }
        }
      }
    };
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
