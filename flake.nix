{
  description = "python flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable-small";
  };

  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    pkgs = import nixpkgs { inherit system; };
  in {

    devShells.${system}.default = pkgs.mkShell {
      packages = with pkgs; [
        python3
        python3Packages.pyaml
      ];
    };
  };
}
