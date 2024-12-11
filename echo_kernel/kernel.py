from ipykernel.kernelbase import Kernel
from ipykernel.comm import CommManager

class EchoKernel(Kernel):
    implementation = 'Echo'
    implementation_version = '1.0'
    language = 'no-op'
    language_version = '0.1'
    language_info = {
        'name': 'echo',
        'mimetype': 'text/plain',
        'file_extension': '.txt',
    }
    banner = "Echo kernel - as useful as a parrot"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.comm_manager = CommManager(parent=self, kernel=self)
        self.comm_manager.register_target('my_comm_target', self._handle_comm_open)

    def _handle_comm_open(self, comm, _):
        @comm.on_msg
        def _recv(msg):
            code = msg['content']['data']['code']
            result = eval(code)  # Note: Using eval for simplicity; in production, use a safer method
            comm.send({'result': result})

    def do_execute(self, code, silent, store_history=True, user_expressions=None,
                   allow_stdin=False):
        if not silent:
            stream_content = {'name': 'stdout', 'text': code}
            self.send_response(self.iopub_socket, 'stream', stream_content)

        return {'status': 'ok',
                # The base class increments the execution count
                'execution_count': self.execution_count,
                'payload': [],
                'user_expressions': {},
               }
