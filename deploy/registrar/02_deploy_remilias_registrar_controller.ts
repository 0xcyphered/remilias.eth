import { Interface } from 'ethers/lib/utils'
import namehash from 'eth-ens-namehash'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const { makeInterfaceId } = require('@openzeppelin/test-helpers')

function computeInterfaceId(iface: Interface) {
  return makeInterfaceId.ERC165(
    // @ts-ignore
    Object.values(iface.functions).map((frag) => frag.format('sighash')),
  )
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registry = await ethers.getContract('ENSRegistry', owner)

  const registrar = await ethers.getContract('RemiliasRegistrar', owner)
  const reverseRegistrar = await ethers.getContract('ReverseRegistrar', owner)
  const nameWrapper = await ethers.getContract('RemiliasNameWrapper', owner)

  const deployArgs = {
    from: deployer,
    args: [
      registrar.address,
      reverseRegistrar.address,
      nameWrapper.address,
      registry.address,
    ],
    log: true,
  }
  const controller = await deploy('RemiliasRegistrarController', deployArgs)
  const RemiliasRegistrarController = await deployments.get(
    'RemiliasRegistrarController',
  )
  const RemiliasRegistrarControllerContract = await ethers.getContractAt(
    RemiliasRegistrarController.abi,
    RemiliasRegistrarController.address,
  )

  // const reverseRegistrarContract = await ethers.getContractAt(
  //   reverseRegistrar.abi,
  //   reverseRegistrar.address,
  // )

  if (owner !== deployer) {
    const tx = await RemiliasRegistrarControllerContract.transferOwnership(
      owner,
    )
    console.log(
      `Transferring ownership of RemiliasRegistrarController to ${owner} (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }

  if (!(await registrar.controllers(RemiliasRegistrarController.address))) {
    const tx = await registrar.addController(RemiliasRegistrarController.address)
    console.log(`Adding controller as controller on registrar (tx: ${tx.hash})...`)
    await tx.wait()
  }

  const isController = await nameWrapper.controllers(controller.address)
  if (!isController) {
    const tx1 = await nameWrapper.setController(controller.address, true)
    console.log(
      `Adding RemiliasRegistrarController as a controller of RemiliasNameWrapper (tx: ${tx1.hash})...`,
    )
    await tx1.wait()
  }
}

func.tags = ['remiliasregistrar', 'RemiliasRegistrarController']
func.dependencies = ['RemiliasRegistrar', 'RemiliasNameWrapper']

export default func
