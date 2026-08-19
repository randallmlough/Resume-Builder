package util

import (
	"fmt"
	"os/exec"
)

func GetProjectPath() (string, error) {
	cmd := exec.Command("go", "env", "GOMOD")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("Error running 'go env -json': %w", err)
	}
	return string(output), nil
}
