import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy('Multicall3', {
    from: deployer,
    args: [],
    log: true,
  })
}

func.id = 'multi-call'
func.tags = ['utils', 'MultiCall3']

export default func
