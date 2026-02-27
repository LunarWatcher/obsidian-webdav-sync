from dataclasses import dataclass
import os

@dataclass
class Copyparty:
    baseUrl: str
    dataDir: str

    # These properties are based on the shares defined in copyparty.conf
    @property
    def root_vault_path(self) -> str:
        return os.path.join(self.dataDir, "vault")

    @property
    def subfolder_path(self) -> str:
        return os.path.join(self.dataDir, "vault/subfolder")

    @property
    def private_subfolder(self) -> str:
        return os.path.join(
            self.dataDir,
            "vault/private_subfolder"
        )
