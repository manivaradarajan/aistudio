import sys
import time
import threading
import itertools

class Spinner:
    """A simple spinner class to show progress for long-running operations."""
    def __init__(self, message="Processing..."):
        self.spinner_cycle = itertools.cycle(["-", "\\", "|", "/"])
        self.delay = 0.1
        self.running = False
        self.spinner_thread = None
        self.message = message

    def _spinner_task(self):
        while self.running:
            sys.stdout.write(f"\r{next(self.spinner_cycle)} {self.message}")
            sys.stdout.flush()
            time.sleep(self.delay)
        # Clear the spinner line
        sys.stdout.write("\r" + " " * (len(self.message) + 3) + "\r")
        sys.stdout.flush()

    def start(self):
        """Starts the spinner in a separate thread."""
        self.running = True
        self.spinner_thread = threading.Thread(target=self._spinner_task)
        self.spinner_thread.daemon = True
        self.spinner_thread.start()

    def stop(self):
        """Stops the spinner and waits for the thread to finish."""
        self.running = False
        if self.spinner_thread and self.spinner_thread.is_alive():
            self.spinner_thread.join()
